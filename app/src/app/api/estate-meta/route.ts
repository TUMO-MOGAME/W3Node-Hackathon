import { z } from "zod";
import { handler, HttpError, isChainMode, json, parseJson, rateLimit } from "@/lib/api/http";
import { getEstateMeta, saveWillDraft, upsertEstateMeta } from "@/lib/db";
import { willDraftSchema } from "@/lib/agent/schemas";
import { hashJson } from "@/lib/agent/hash";
import { fetchAccountRaw } from "@/lib/chain/reads";
import { key, hex } from "@/lib/chain/decoders";

const addr = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
const body = z.object({
  estate: addr,
  ownerWallet: addr,
  ownerName: z.string().min(1).max(80),
  verifierNames: z.tuple([z.string().max(64), z.string().max(64), z.string().max(64)]),
  assetTitles: z.record(z.string(), z.string().max(120)).default({}),
  buyerNames: z.record(z.string(), z.string().max(64)).default({}),
  draft: willDraftSchema.optional(),
});

/** GET /api/estate-meta?estate=… → display names (off-chain, POPIA-scoped). */
export const GET = handler(async (req) => {
  rateLimit(req, "estate-meta", 60);
  const estate = addr.parse(new URL(req.url).searchParams.get("estate"));
  return json((await getEstateMeta(estate)) ?? null);
});

/**
 * POST /api/estate-meta → saves names (+ the signed WillDraft). In chain mode the estate must exist on-chain,
 * belong to ownerWallet, and the draft's canonical hash must equal the will_hash the owner signed.
 */
export const POST = handler(async (req) => {
  rateLimit(req, "estate-meta-write", 10);
  const b = await parseJson(req, body);
  const willHash = b.draft ? await hashJson(b.draft) : null;
  if (isChainMode()) {
    const raw = await fetchAccountRaw("Estate", b.estate);
    if (!raw) throw new HttpError(404, "Estate not found on-chain");
    if (key(raw, "owner") !== b.ownerWallet) throw new HttpError(403, "Only the estate owner can name it");
    if (willHash && hex(raw, "will_hash") !== willHash) throw new HttpError(409, "Draft does not match the on-chain will hash");
  }
  await upsertEstateMeta({ estate: b.estate, ownerWallet: b.ownerWallet, ownerName: b.ownerName, verifierNames: b.verifierNames, assetTitles: b.assetTitles, buyerNames: b.buyerNames });
  if (b.draft && willHash) await saveWillDraft(b.ownerWallet, b.draft, willHash);
  return json({ ok: true, willHash });
});
