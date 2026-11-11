/**
 * Pure helpers for the chat shell: suggested prompts for the empty state, and turning a document the
 * person attached into an agent message (the reviewer's summary plus the right next step).
 */
import type { EstateSnapshot } from "@/lib/service";
import type { AgentReport, EstateStatus, Role } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";
import type { AgentAction } from "../hooks/agent-types";
import { chatCopy, fill } from "./nudge-copy";
import type { ChatAttachment } from "./types";

/** Suggested prompts, by who is acting and where the estate is. */
export function suggestionsFor(role: Role | null, status: EstateStatus | null, locale: Locale = "en"): string[] {
  const s = chatCopy(locale).suggestions;
  if (!role) return [...s.guest];
  const byRole = s[role];
  if (!status) return [...byRole.none];
  return [...(status === "Frozen" ? byRole.Active : byRole[status])];
}

export type ReviewPurpose = "death" | "claim" | "hardship";

/** The reviewer purpose for an attachment: as chosen, else guessed from the message and file name. */
export function reviewPurpose(purpose: ChatAttachment["purpose"], text: string, fileName: string): ReviewPurpose {
  if (purpose && purpose !== "general") return purpose;
  const q = `${text} ${fileName}`.toLowerCase();
  if (/death|certificate|passed|died|bi-?1663|dha/.test(q)) return "death";
  if (/hardship|affidavit|saps|need/.test(q)) return "hardship";
  return "claim";
}

export function attachmentKind(file: { name: string; type: string }): ChatAttachment["kind"] {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name) ? "pdf" : "image";
}

/** Context for the reviewer: for a claim, the payee the person's rule pays (so it can check the statement). */
export function reviewContext(snap: EstateSnapshot | null, address: string | null, purpose: ReviewPurpose, text: string): string {
  if (purpose !== "claim" || !snap) return text;
  const rule = snap.rules.find((r) => r.beneficiary === address && r.recurringAmount === BigInt(0));
  const payee = rule ? snap.payees.find((p) => p.kind === rule.allowedPayeeKind)?.name : undefined;
  return payee ?? text;
}

/** The agent's message after reading an attached document. */
export function attachmentReply(
  report: AgentReport,
  ctx: { name: string; purpose: ReviewPurpose; role: Role | null; snap: EstateSnapshot | null; address: string | null },
  locale: Locale = "en",
): { text: string; actions: AgentAction[] } {
  const c = chatCopy(locale).attachment;
  const type = c.types[report.documentType] ?? c.typeFallback;
  const parts = [fill(c.report, {
    name: ctx.name, type, confidence: Math.round(Math.max(0, Math.min(1, report.confidence)) * 100),
    verdict: c.verdict[report.verdict], summary: report.summary,
  }).trim()];
  if (report.redFlags.length) parts.push(fill(c.redFlags, { flags: report.redFlags.join("; ") }));

  const actions: AgentAction[] = [];
  const status = ctx.snap?.estate.status ?? null;
  const ok = report.verdict !== "reject";
  if (ctx.role === "beneficiary" && ok) {
    if (ctx.purpose === "death" && status === "Active") {
      parts.push(c.next.death);
      actions.push({ type: "startUpload", purpose: "death" });
    } else if (ctx.purpose === "hardship" && status === "Unlocked") {
      parts.push(c.next.hardship);
      actions.push({ type: "startUpload", purpose: "hardship" });
    } else if (ctx.purpose === "claim") {
      const rule = ctx.snap?.rules.find((r) => r.beneficiary === ctx.address && r.recurringAmount === BigInt(0)
        && (status === "Unlocked" || (r.startsNow && status === "Active")));
      if (rule) {
        parts.push(c.next.claim);
        const payee = ctx.snap?.payees.find((p) => p.kind === rule.allowedPayeeKind);
        // No amount prefill: statements are in rand and the form asks for USD₮.
        actions.push({ type: "openClaimForm", rule: rule.address, payee: payee?.wallet });
        actions.push({ type: "showRule", rule: rule.address });
      } else {
        actions.push({ type: "navigate", to: "/estate" });
      }
    }
  } else if (ctx.role === "verifier") {
    parts.push(c.next.verifier);
    actions.push({ type: "navigate", to: "/inbox" });
  } else if (ok && ctx.role !== "beneficiary") {
    parts.push(c.next.other);
  }
  return { text: parts.join("\n\n"), actions };
}
