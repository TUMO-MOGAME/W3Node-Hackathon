/**
 * Browser side of the wallet assistant, shared by the Send screen and the agent chat:
 * ask /api/assistant/qvac (Tether QVAC when it runs locally, labelled fallback otherwise), then check the
 * details here: saved recipients, live USD₮/ZAR rate. If the route can't be reached (poor connection), the same
 * deterministic parser runs in the browser. It never sends: the caller opens the payment review.
 */
import type { AssistantCopy } from "@/content/assistant";
import type { HeirloomService } from "@/lib/service";
import type { SavedRecipient } from "@/lib/types";
import { formatUsdt, toBase } from "@/lib/format";
import { parseIntentFallback, planSend, walletIntentSchema, type IntentEngine, type SendPlan, type WalletIntent } from "./intent";

export interface AssistantResult { plan: SendPlan; intent: WalletIntent; engine: IntentEngine; note: string; recipients: SavedRecipient[]; rate: number | null }

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");

export async function interpretRequest(text: string, service: HeirloomService, rate: number | null, copy: AssistantCopy["wallet"]): Promise<AssistantResult> {
  const [recipients, usdtZar] = await Promise.all([
    service.savedRecipients().catch(() => [] as SavedRecipient[]),
    rate ? Promise.resolve(rate) : service.getFx().then((f) => f.usdtZar).catch(() => null),
  ]);
  let intent: WalletIntent;
  let engine: IntentEngine = "fallback";
  let note: string = copy.offline;
  try {
    const res = await fetch("/api/assistant/qvac", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, recipients: recipients.map((r) => ({ label: r.label, address: r.address, relationship: r.relationship })) }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { intent: unknown; engine: IntentEngine; note: string };
    intent = walletIntentSchema.parse(data.intent);
    engine = data.engine === "qvac" ? "qvac" : "fallback";
    note = typeof data.note === "string" ? data.note : "";
  } catch {
    intent = parseIntentFallback(text, recipients);
  }
  return { plan: planSend(intent, recipients, usdtZar), intent, engine, note, recipients, rate: usdtZar };
}

/** One plain sentence for what was understood, or what is missing. */
export function describeResult(r: AssistantResult, copy: AssistantCopy["wallet"]): string {
  const p = r.plan;
  if (p.ok) {
    const usdt = formatUsdt(toBase(p.amountUsdt));
    const amount = p.amountZar !== null && r.rate
      ? fill(copy.understoodZar, { zar: `R${p.amountZar.toLocaleString("en-ZA")}`, usdt, rate: r.rate.toFixed(2) })
      : usdt;
    return fill(copy.understood, { amount, name: p.toLabel || copy.title, memo: p.memo ? fill(copy.memo, { memo: p.memo }) : "" });
  }
  if (p.reason === "no_recipient") return p.intent.recipient ? fill(copy.reasons.no_recipient, { name: p.intent.recipient }) : copy.reasons.no_recipient_blank;
  if (p.reason === "ambiguous") return fill(copy.reasons.ambiguous, { names: (p.candidates ?? []).map((c) => c.label).join(" or ") });
  return copy.reasons[p.reason];
}

/** The label the review sheet shows: the person, plus what it is for. */
export function reviewLabel(p: Extract<SendPlan, { ok: true }>, copy: AssistantCopy["wallet"]): string {
  return p.memo && p.toLabel ? fill(copy.labelMemo, { name: p.toLabel, memo: p.memo }).slice(0, 80) : p.toLabel;
}
