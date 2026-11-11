import "server-only";
/**
 * Scheduled payments ("living plans"): finds recurring rules whose next payment is due and executes them with
 * execute_scheduled, the agent's WDK wallet paying only the network fee. The program re-checks everything
 * (due time, caps, end date, estate status, fixed payee), so a wrong pick here just fails harmlessly.
 */
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { accountDiscriminator, getCoder, getIdl } from "../chain/idl";
import { decodeRule, decodeEstate, type Raw } from "../chain/decoders";
import { getConnection } from "../chain/tx";
import { chainCtx } from "../chain/client";
import { executeScheduled } from "../chain/instructions";
import { agentAddress, agentSignAndSend } from "../agent/agent-wallet";
import type { Rule } from "../types";

export interface TickResult { rule: string; estate: string; ok: boolean; signature?: string; explorerUrl?: string; error?: string }

/** Pure: is this rule due for a scheduled payment at `now`? (mirrors the program's checks) */
export function isDue(rule: Rule, estateStatus: string, now: number): boolean {
  if (rule.recurringAmount <= 0n || !rule.fixedPayee || rule.nextDue === null) return false;
  if (rule.nextDue > now || now > rule.validUntil) return false;
  if (rule.spentTotal + rule.recurringAmount > rule.lifetimeCap) return false;
  return rule.startsNow ? estateStatus === "Active" || estateStatus === "DeathPending" || estateStatus === "Unlocked" : estateStatus === "Unlocked";
}

export async function runDueSchedules(now = Math.floor(Date.now() / 1000), max = 10): Promise<TickResult[]> {
  if (!getIdl().instructions.some((i) => i.name === "execute_scheduled")) return [];
  const conn = getConnection();
  const programId = new PublicKey(getIdl().address);
  const rules = await conn.getProgramAccounts(programId, {
    commitment: "confirmed",
    filters: [{ memcmp: { offset: 0, bytes: bs58.encode(accountDiscriminator("Rule")) } }],
  });
  const decoded = rules.map((a) => {
    const raw = getCoder().accounts.decode("Rule", a.account.data) as Raw;
    return { estate: String(raw.estate), rule: decodeRule(a.pubkey.toBase58(), raw) };
  }).filter((x) => x.rule.recurringAmount > 0n && x.rule.nextDue !== null && x.rule.nextDue <= now);
  if (decoded.length === 0) return [];

  const statuses = new Map<string, string>();
  for (const e of new Set(decoded.map((d) => d.estate))) {
    const info = await conn.getAccountInfo(new PublicKey(e), "confirmed");
    if (info) statuses.set(e, decodeEstate(e, getCoder().accounts.decode("Estate", info.data) as Raw, 0n).status);
  }

  const agent = new PublicKey((await agentAddress())!);
  const ctx = chainCtx();
  const out: TickResult[] = [];
  for (const d of decoded.filter((x) => isDue(x.rule, statuses.get(x.estate) ?? "", now)).slice(0, max)) {
    try {
      const tx = await agentSignAndSend([executeScheduled(ctx, {
        estate: new PublicKey(d.estate), payer: agent, rule: new PublicKey(d.rule.address), payeeWallet: new PublicKey(d.rule.fixedPayee!),
      })]);
      out.push({ rule: d.rule.address, estate: d.estate, ok: true, ...tx });
    } catch (e) {
      out.push({ rule: d.rule.address, estate: d.estate, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
