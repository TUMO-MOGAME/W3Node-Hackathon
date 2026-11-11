/**
 * Read side: fetch and decode every account of one estate, plus the activity feed from program events.
 * Uses getProgramAccounts with a discriminator + parent-key memcmp (the parent pubkey is the first field
 * after the 8-byte discriminator for Beneficiary/Payee/Rule/Claim/Asset (estate) and Offer/Hardship (asset)).
 */
import { EventParser } from "@anchor-lang/core";
import { PublicKey, type Connection } from "@solana/web3.js";
import type { ActivityItem, Base58 } from "../types";
import { accountDiscriminator, accountName, getCoder, getIdl } from "./idl";
import {
  hex, key, ruleCount, decodeAsset, decodeBeneficiary, decodeClaim, decodeEstate, decodeHardship, decodeOffer, decodePayee, decodeRule,
  type OffChainNames, type Raw,
} from "./decoders";
import { estatePda, vaultAta } from "./pda";
import { getConnection } from "./tx";
import { describeEvent } from "./events";

export interface RawSnapshot {
  estate: ReturnType<typeof decodeEstate>;
  ruleCount: number;
  beneficiaries: ReturnType<typeof decodeBeneficiary>[];
  payees: ReturnType<typeof decodePayee>[];
  rules: ReturnType<typeof decodeRule>[];
  claims: ReturnType<typeof decodeClaim>[];
  assets: ReturnType<typeof decodeAsset>[];
  offers: ReturnType<typeof decodeOffer>[];
  hardships: ReturnType<typeof decodeHardship>[];
  /** claim / hardship address → agent_report_hash (hex), for joining the off-chain AgentReport. */
  reportHashes: Record<string, string>;
}

const programId = () => new PublicKey(getIdl().address);

function decode(name: string, data: Uint8Array): Raw {
  // Anchor's coder takes a Node-style Buffer; web3.js already gives us one.
  return getCoder().accounts.decode(accountName(name), data as Parameters<ReturnType<typeof getCoder>["accounts"]["decode"]>[1]) as Raw;
}

/**
 * One getProgramAccounts scan of the whole program, shared by every read for a few seconds.
 * The public devnet RPC throttles getProgramAccounts per method (HTTP 429 after a handful of calls), and one
 * estate load used to need 7+ filtered scans, so the dashboard could never finish loading. A single unfiltered
 * scan is cheap at hackathon scale; a production deployment would use an indexer or a paid RPC with filters.
 */
export interface ProgramAccount { pubkey: PublicKey; data: Uint8Array }
let scan: { at: number; accounts: Promise<ProgramAccount[]> } | null = null;
export function programAccounts(conn = getConnection(), maxAgeMs = 8_000): Promise<ProgramAccount[]> {
  if (scan && Date.now() - scan.at < maxAgeMs) return scan.accounts;
  const accounts = conn.getProgramAccounts(programId(), { commitment: "confirmed" })
    .then((res) => res.map((a) => ({ pubkey: a.pubkey, data: a.account.data as Uint8Array })));
  const entry = { at: Date.now(), accounts };
  scan = entry;
  accounts.catch(() => { if (scan === entry) scan = null; });
  return accounts;
}
/** Forget the shared scan (call after a write so the next read sees it). */
export function invalidateProgramAccounts(): void { scan = null; }

const startsWith = (data: Uint8Array, prefix: Uint8Array, at = 0) => prefix.every((b, i) => data[at + i] === b);

/** Accounts of `type` whose first field (after the 8-byte discriminator) is `parent`, optionally another key at `offset`. */
export async function scanAccounts(type: string, match: { offset: number; key: PublicKey }[], conn = getConnection()): Promise<ProgramAccount[]> {
  const disc = accountDiscriminator(type);
  return (await programAccounts(conn)).filter((a) => startsWith(a.data, disc) && match.every((m) => startsWith(a.data, m.key.toBytes(), m.offset)));
}

async function fetchChildren(conn: Connection, type: string, parent: PublicKey): Promise<{ address: string; raw: Raw }[]> {
  const res = await scanAccounts(type, [{ offset: 8, key: parent }], conn);
  return res.map((a) => ({ address: a.pubkey.toBase58(), raw: decode(type, a.data) }));
}

export async function fetchEstateRaw(estate: Base58, names: OffChainNames = {}, conn = getConnection()): Promise<RawSnapshot> {
  const estateKey = new PublicKey(estate);
  const info = await conn.getAccountInfo(estateKey, "confirmed");
  if (!info) throw new Error(`No Heirloom estate at ${estate} on this cluster.`);
  const raw = decode("Estate", info.data);
  const mint = new PublicKey(key(raw, "usdt_mint"));
  const vault = vaultAta(mint, estateKey);
  const vaultBal = await conn.getTokenAccountBalance(vault, "confirmed").then((b) => BigInt(b.value.amount)).catch(() => 0n);
  const estateObj = decodeEstate(estate, raw, vaultBal, names);

  const [bens, payees, rules, claims, assets] = await Promise.all([
    fetchChildren(conn, "Beneficiary", estateKey),
    fetchChildren(conn, "Payee", estateKey),
    fetchChildren(conn, "Rule", estateKey),
    fetchChildren(conn, "Claim", estateKey),
    fetchChildren(conn, "Asset", estateKey),
  ]);
  const assetObjs = assets.map((a) => {
    const nft = key(a.raw, "nft_mint");
    return decodeAsset(a.address, a.raw, names.assetTitles?.[nft]);
  });
  const perAsset = await Promise.all(assetObjs.map(async (a) => {
    const k = new PublicKey(a.address);
    const [o, h] = await Promise.all([fetchChildren(conn, "Offer", k), fetchChildren(conn, "Hardship", k)]);
    return {
      offers: o.map((x) => { const d = decodeOffer(x.address, x.raw); return { ...d, buyerName: names.buyerNames?.[d.buyer] }; }),
      hardships: h.map((x) => decodeHardship(x.address, x.raw)),
      hardshipReports: h.map((x) => [x.address, hex(x.raw, "agent_report_hash")] as const),
    };
  }));

  return {
    estate: estateObj,
    ruleCount: ruleCount(raw),
    beneficiaries: bens.map((b) => decodeBeneficiary(b.address, b.raw)),
    payees: payees.map((p) => decodePayee(p.address, p.raw)),
    rules: rules.map((r) => decodeRule(r.address, r.raw)).sort((a, b) => a.id - b.id),
    claims: claims.map((c) => decodeClaim(c.address, c.raw)).sort((a, b) => b.createdAt - a.createdAt),
    assets: assetObjs,
    offers: perAsset.flatMap((x) => x.offers).sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0)),
    hardships: perAsset.flatMap((x) => x.hardships),
    reportHashes: Object.fromEntries([
      ...claims.map((c) => [c.address, hex(c.raw, "agent_report_hash")] as const),
      ...perAsset.flatMap((x) => x.hardshipReports),
    ].filter(([, h]) => h !== "0".repeat(64))),
  };
}

/** Does `owner` have an estate? Returns its address or null. */
export async function findEstateOf(owner: Base58, conn = getConnection()): Promise<Base58 | null> {
  const pda = estatePda(programId(), owner);
  const info = await conn.getAccountInfo(pda, "confirmed");
  return info ? pda.toBase58() : null;
}

/** Recent program events that touched the estate (newest first). */
export async function fetchActivity(estate: Base58, limit = 40, conn = getConnection()): Promise<ActivityItem[]> {
  const sigs = await conn.getSignaturesForAddress(new PublicKey(estate), { limit }, "confirmed");
  const ok = sigs.filter((s) => !s.err);
  if (ok.length === 0) return [];
  const txs = await conn.getTransactions(ok.map((s) => s.signature), { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
  const parser = new EventParser(programId(), getCoder());
  const items: ActivityItem[] = [];
  txs.forEach((tx, i) => {
    const logs = tx?.meta?.logMessages;
    if (!logs) return;
    const ts = tx.blockTime ?? ok[i].blockTime ?? 0;
    try {
      for (const ev of parser.parseLogs(logs)) {
        const d = describeEvent(ev.name, ev.data as Raw);
        let reportHash: string | undefined;
        try { reportHash = d.kind.endsWith("Reviewed") ? hex(ev.data as Raw, "report_hash") : undefined; } catch { /* no hash on this event */ }
        items.push({ ts, kind: d.kind, text: d.text, amount: d.amount, txSignature: ok[i].signature, ...(reportHash ? { reportHash } : {}) });
      }
    } catch {
      // A log we cannot decode (e.g. older IDL) is skipped, not fatal for the feed.
    }
  });
  return items.sort((a, b) => b.ts - a.ts);
}

/** Fetch and decode a single program account (raw IDL field names). Null if it does not exist. */
export async function fetchAccountRaw(type: string, address: Base58, conn = getConnection()): Promise<Raw | null> {
  const info = await conn.getAccountInfo(new PublicKey(address), "confirmed");
  return info ? decode(type, info.data) : null;
}
