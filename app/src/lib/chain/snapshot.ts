/**
 * Joins on-chain state (RawSnapshot) with off-chain extras (activity feed, agent reports) into the
 * EstateSnapshot the UI uses. Pure.
 */
import type { ActivityItem, AgentReport } from "../types";
import type { EstateSnapshot } from "../service/types";
import type { RawSnapshot } from "./reads";

export function assembleSnapshot(raw: RawSnapshot, activity: ActivityItem[], reports: Record<string, AgentReport>): EstateSnapshot {
  const reportFor = (address: string) => {
    const h = raw.reportHashes[address];
    return h ? reports[h] : undefined;
  };
  return {
    estate: raw.estate,
    beneficiaries: raw.beneficiaries,
    payees: raw.payees,
    rules: raw.rules,
    claims: raw.claims.map((c) => ({ ...c, agentReport: reportFor(c.address) })),
    assets: raw.assets,
    offers: raw.offers,
    hardships: raw.hardships.map((h) => ({ ...h, agentReport: reportFor(h.address) })),
    activity,
  };
}
