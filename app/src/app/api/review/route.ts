import { PublicKey } from "@solana/web3.js";
import { handler, HttpError, isChainMode, json, rateLimit } from "@/lib/api/http";
import { reviewFields } from "@/lib/agent/schemas";
import { reviewDocument } from "@/lib/agent/review";
import { MAX_UPLOAD_BYTES, storeEvidence } from "@/lib/storage";
import { recordEvidence, saveReport } from "@/lib/db";
import { fetchAccountRaw } from "@/lib/chain/reads";
import { hex, key } from "@/lib/chain/decoders";
import { reviewClaim, reviewDeath, reviewHardship } from "@/lib/chain/instructions";
import { agentSignAndSend, hasAgentWallet, agentAddress } from "@/lib/agent/agent-wallet";

export const maxDuration = 90;

/**
 * POST /api/review (multipart: file, purpose=death|claim|hardship, estate, context, subject?, preview?=1)
 * 1. validate + store the file (private bucket), hash it
 * 2. chain mode: the hash must equal the evidence hash already on-chain (death claim / claim / hardship)
 * 3. Gemini DocumentReviewer → AgentReport (reportHash = sha256 of canonical JSON)
 * 4. the agent's WDK wallet signs review_* with approve = verdict !== "reject". "needs_human" is forwarded to the
 *    human verifiers (who must still approve on-chain) with the red flags attached; only "reject" blocks.
 * Returns { report, evidence: { sha256 }, tx: { signature, explorerUrl } | null, onChain: string }.
 */
export const POST = handler(async (req) => {
  rateLimit(req, "review", 8);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 64_000) throw new HttpError(413, "The file is larger than 10 MB.");
  const form = await req.formData().catch(() => { throw new HttpError(400, "Expected a form upload with the document as `file`."); });
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Attach the document as `file`.");
  const fields = reviewFields.parse({
    purpose: form.get("purpose"), estate: form.get("estate"), context: form.get("context") ?? "", subject: form.get("subject") ?? undefined,
  });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const stored = await storeEvidence(bytes, file.type, fields.purpose);

  // On-chain integrity: the uploaded file must be the one whose hash the family member submitted.
  let onChainTarget: { kind: "death" } | { kind: "claim"; claim: string; rule: string } | { kind: "hardship"; hardship: string; asset: string } | null = null;
  const preview = form.get("preview") === "1"; // review only: no on-chain hash check and no agent tx
  if (isChainMode() && !preview) {
    if (fields.purpose === "death") {
      const est = await fetchAccountRaw("Estate", fields.estate);
      if (!est) throw new HttpError(404, "Estate not found on-chain.");
      if (hex(est, "death_cert_hash") !== stored.sha256) throw new HttpError(409, "This file does not match the death certificate hash submitted on-chain.");
      onChainTarget = { kind: "death" };
    } else {
      if (!fields.subject) throw new HttpError(400, "subject (claim or hardship address) is required.");
      const type = fields.purpose === "claim" ? "Claim" : "Hardship";
      const acc = await fetchAccountRaw(type, fields.subject);
      if (!acc) throw new HttpError(404, `${type} not found on-chain.`);
      if (hex(acc, "evidence_hash") !== stored.sha256) throw new HttpError(409, `This file does not match the ${type.toLowerCase()} evidence hash on-chain.`);
      onChainTarget = fields.purpose === "claim"
        ? { kind: "claim", claim: fields.subject, rule: key(acc, "rule") }
        : { kind: "hardship", hardship: fields.subject, asset: key(acc, "asset") };
    }
  }

  const report = await reviewDocument({ bytes, mime: stored.mime, purpose: fields.purpose, context: fields.context, evidenceSha256: stored.sha256 });
  await recordEvidence(stored.path, stored.sha256, fields.purpose, stored.mime, stored.size);

  let tx: { signature: string; explorerUrl: string } | null = null;
  let onChain = preview ? "skipped (preview)" : "skipped (mock mode)";
  if (onChainTarget) {
    if (!hasAgentWallet()) onChain = "skipped (AGENT_SEED_PHRASE not set)";
    else {
      const agent = new PublicKey((await agentAddress())!);
      const estate = new PublicKey(fields.estate);
      const approve = report.verdict !== "reject";
      const ixs = onChainTarget.kind === "death"
        ? [reviewDeath(estate, agent, approve, report.reportHash)]
        : onChainTarget.kind === "claim"
          ? [reviewClaim(estate, agent, new PublicKey(onChainTarget.claim), new PublicKey(onChainTarget.rule), approve, report.reportHash)]
          : [reviewHardship(estate, agent, new PublicKey(onChainTarget.asset), new PublicKey(onChainTarget.hardship), approve, report.reportHash)];
      tx = await agentSignAndSend(ixs);
      onChain = approve ? "agent approved on-chain; waiting for human verifiers" : "agent rejected on-chain";
    }
  }

  await saveReport({
    reportHash: report.reportHash, purpose: fields.purpose, estate: fields.estate, subject: fields.subject ?? null,
    evidencePath: stored.path, evidenceSha256: stored.sha256, report, txSignature: tx?.signature ?? null,
  });
  return json({ report, evidence: { sha256: stored.sha256, storage: stored.backend }, tx, onChain });
});
