import "server-only";
/** Server-side estate snapshot: chain state + off-chain names (db) + activity + agent reports. */
import type { EstateSnapshot } from "../service/types";
import { fetchActivity, fetchEstateRaw } from "../chain/reads";
import { assembleSnapshot } from "../chain/snapshot";
import { getEstateMeta, getReports } from "../db";

export async function loadSnapshot(estate: string): Promise<EstateSnapshot> {
  const meta = await getEstateMeta(estate);
  const raw = await fetchEstateRaw(estate, meta ? {
    ownerName: meta.ownerName, verifierNames: meta.verifierNames, assetTitles: meta.assetTitles, buyerNames: meta.buyerNames,
  } : {});
  const [activity, reports] = await Promise.all([
    fetchActivity(estate).catch(() => []),
    getReports(Object.values(raw.reportHashes)),
  ]);
  return assembleSnapshot(raw, activity, reports);
}
