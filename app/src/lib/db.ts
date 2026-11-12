import "server-only";
/**
 * Off-chain metadata in Supabase Postgres (schema: supabase/migrations/0001_init.sql): display names,
 * will drafts, agent reports (full JSON; the chain has only the hash), evidence index, chat/voice
 * transcripts. Every function falls back to an in-memory store when Supabase is not configured.
 */
import { getSupabase } from "./supabase";
import type { AgentReport, WillDraft } from "./types";
import type { SpecialistName } from "./voice/types";
import { chainConfig } from "./chain/config";
import { DEVNET_DEMO_META } from "./chain/demo-estate";

export interface EstateMeta {
  estate: string;
  ownerWallet: string;
  ownerName: string;
  verifierNames: [string, string, string];
  assetTitles: Record<string, string>;
  buyerNames: Record<string, string>;
}

export interface ReportRow {
  reportHash: string;
  purpose: "death" | "claim" | "hardship" | "valuation" | "offers";
  estate: string | null;
  subject: string | null;
  evidencePath: string | null;
  evidenceSha256: string | null;
  report: AgentReport;
  txSignature: string | null;
}

export interface TranscriptRow {
  sessionId: string;
  channel: "text" | "voice";
  persona: string | null;
  estate: string | null;
  role: "user" | "agent";
  specialist: SpecialistName | null;
  text: string;
}

const mem = {
  estates: new Map<string, EstateMeta>(),
  reports: new Map<string, ReportRow>(),
  drafts: [] as { ownerWallet: string | null; draft: WillDraft; willHash: string }[],
  transcripts: [] as TranscriptRow[],
  evidence: new Map<string, { sha256: string; purpose: string; mime: string; size: number }>(),
};
// Devnet without Supabase: keep the seeded demo family's names across restarts (fictional people; see demo-estate.ts).
if (chainConfig.cluster === "devnet") mem.estates.set(DEVNET_DEMO_META.estate, DEVNET_DEMO_META);

function warn(what: string, err: { message: string } | null) {
  if (err) console.warn(`[db] ${what} failed: ${err.message}`);
}

export async function upsertEstateMeta(m: EstateMeta): Promise<void> {
  const sb = getSupabase();
  if (!sb) { mem.estates.set(m.estate, m); return; }
  const { error } = await sb.from("estate_meta").upsert({
    estate: m.estate, owner_wallet: m.ownerWallet, owner_name: m.ownerName, verifier_names: m.verifierNames,
    asset_titles: m.assetTitles, buyer_names: m.buyerNames, updated_at: new Date().toISOString(),
  });
  warn("upsertEstateMeta", error);
}

export async function getEstateMeta(estate: string): Promise<EstateMeta | null> {
  const sb = getSupabase();
  if (!sb) return mem.estates.get(estate) ?? null;
  const { data, error } = await sb.from("estate_meta").select("*").eq("estate", estate).maybeSingle();
  warn("getEstateMeta", error);
  if (!data) return null;
  return {
    estate: data.estate, ownerWallet: data.owner_wallet, ownerName: data.owner_name, verifierNames: data.verifier_names,
    assetTitles: data.asset_titles ?? {}, buyerNames: data.buyer_names ?? {},
  };
}

export async function saveWillDraft(ownerWallet: string | null, draft: WillDraft, willHash: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) { mem.drafts.push({ ownerWallet, draft, willHash }); return; }
  const { error } = await sb.from("will_drafts").insert({ owner_wallet: ownerWallet, draft, will_hash: willHash });
  warn("saveWillDraft", error);
}

export async function saveReport(r: ReportRow): Promise<void> {
  const sb = getSupabase();
  if (!sb) { mem.reports.set(r.reportHash, r); return; }
  const { error } = await sb.from("agent_reports").upsert({
    report_hash: r.reportHash, purpose: r.purpose, estate: r.estate, subject: r.subject, evidence_path: r.evidencePath,
    evidence_sha256: r.evidenceSha256, report: r.report, tx_signature: r.txSignature,
  });
  warn("saveReport", error);
}

export async function getReports(hashes: string[]): Promise<Record<string, AgentReport>> {
  const out: Record<string, AgentReport> = {};
  if (hashes.length === 0) return out;
  const sb = getSupabase();
  if (!sb) {
    for (const h of hashes) { const r = mem.reports.get(h); if (r) out[h] = r.report; }
    return out;
  }
  const { data, error } = await sb.from("agent_reports").select("report_hash, report").in("report_hash", hashes);
  warn("getReports", error);
  for (const row of data ?? []) out[row.report_hash as string] = row.report as AgentReport;
  return out;
}

export async function recordEvidence(path: string, sha256: string, purpose: string, mime: string, size: number): Promise<void> {
  const sb = getSupabase();
  if (!sb) { mem.evidence.set(path, { sha256, purpose, mime, size }); return; }
  const { error } = await sb.from("evidence").upsert({ path, sha256, purpose, mime, size });
  warn("recordEvidence", error);
}

export async function saveTranscript(rows: TranscriptRow[]): Promise<void> {
  if (rows.length === 0) return;
  const sb = getSupabase();
  if (!sb) { mem.transcripts.push(...rows); if (mem.transcripts.length > 2000) mem.transcripts.splice(0, 1000); return; }
  const { error } = await sb.from("transcripts").insert(rows.map((r) => ({
    session_id: r.sessionId, channel: r.channel, persona: r.persona, estate: r.estate, role: r.role, specialist: r.specialist, text: r.text,
  })));
  warn("saveTranscript", error);
}
