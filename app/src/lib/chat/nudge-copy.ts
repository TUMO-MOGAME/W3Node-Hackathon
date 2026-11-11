/**
 * Copy for the chat-first shell's data layer: "needs your attention" nudges, suggested prompts for the
 * empty chat, and the agent's note after reading an attached document. Kept here (not in content/*,
 * which the design agent owns). English is the source; other languages may override any slot and
 * fall back to English. {curly} values are filled at runtime.
 */
import type { Locale } from "@/lib/i18n/locales";
import { mergeCopy, type DeepPartial } from "@/lib/i18n/merge";

const en = {
  nudges: {
    scheduledDue: {
      title: "A payment is due today",
      body: "{name}'s {category} payment ({amount}{zar}) to {payee} is due. Want me to pay it now?",
      cta: "Pay it now",
    },
    claimOwner: {
      title: "A claim needs your approval",
      body: "{name} asked for {amount}{zar} to go to {payee}. I've read the document and it checks out. It pays only once you approve.",
      cta: "Review the claim",
    },
    claimVerifier: {
      title: "A claim is waiting for you",
      body: "{name} asked for {amount}{zar} to go to {payee}. My report is attached. One trusted person's approval releases it.",
      cta: "Open your inbox",
    },
    deathToConfirm: {
      title: "A passing was reported",
      body: "{name} reported that {owner} has passed away. I've checked the certificate. Please confirm only what you know to be true.",
      cta: "Review and confirm",
    },
    unlockReady: {
      title: "The estate can unlock",
      body: "The waiting period is over and nobody cancelled it. Unlocking puts {owner}'s rules in force.",
      cta: "Unlock the estate",
    },
    hardshipToReview: {
      title: "A hardship request needs you",
      body: "{name} asked for the car to sell below the minimum price. I've checked the affidavit. Two trusted people must agree.",
      cta: "Review the request",
    },
    offerReceived: {
      title: "The car has an offer to settle",
      body: "The best offer for the {title} is {amount}{zar}, at or above the minimum. You can accept it and the sale completes in one step.",
      bodyEnded: "The listing for the {title} has ended. The best offer is {amount}{zar}, at or above the minimum. Settle it now.",
      cta: "Settle the sale",
    },
    legacyMessage: {
      title: "A message from {calledBy}",
      body: "{calledBy} left you a message for this moment: \"{milestone}\". Listen when you're ready.",
      bodyGeneric: "{calledBy} left you a message for when your fees were paid. Listen when you're ready.",
      cta: "Listen now",
    },
    heartbeat: {
      title: "Time to check in",
      body: "You last checked in {days} days ago. A quick check-in tells your trusted people all is well.",
      bodyNever: "You haven't checked in yet. A quick check-in tells your trusted people all is well.",
      cta: "Check in",
    },
    deathReported: {
      title: "Someone reported your passing",
      body: "If this is a mistake, one tap on \"I'm still here\" cancels it and keeps the vault locked.",
      cta: "I'm still here",
    },
    fundVault: {
      title: "Top up the vault",
      body: "The vault holds {vault}, but {due}{zar} of scheduled payments fall due in the next 30 days.",
      cta: "Add funds",
    },
    dismiss: "Not now",
    someone: "Someone",
    institution: "the institution",
  },
  suggestions: {
    owner: {
      Active: ["What can start paying now?", "Is everything set up for my family?", "What stops someone draining the vault?", "Send R500 to Lerato for books"],
      DeathPending: ["Someone reported my passing. What now?", "How do I cancel this report?", "What is waiting for me?"],
      Unlocked: ["What happens to my estate now?", "Which payments have gone out?"],
      none: ["Help me write my family plan", "How does Heirloom work?", "Is this a legal will?"],
    },
    beneficiary: {
      Active: ["What does my dad's plan cover?", "When is my next allowance?", "What happens after I report a passing?"],
      DeathPending: ["How long is the waiting period?", "What happens when the estate unlocks?", "Who has confirmed so far?"],
      Unlocked: ["How do I claim my fees?", "Can the car sell for less?", "Who approves my claim?", "Is there a message from my dad?"],
      none: ["How does Heirloom work?", "What is a living plan?"],
    },
    verifier: {
      Active: ["What is waiting for me?", "What am I confirming exactly?", "How do you check a death certificate?"],
      DeathPending: ["When can the estate unlock?", "What happens if the report was a mistake?"],
      Unlocked: ["What is waiting for me?", "Should I accept the best car offer?", "How do you check a fee statement?"],
      none: ["What does a trusted person do?", "How does Heirloom work?"],
    },
    buyer: {
      Active: ["When will the car be for sale?", "How does escrow work?"],
      DeathPending: ["When will the car be for sale?", "How does escrow work?"],
      Unlocked: ["What is the minimum price?", "How does escrow work?", "What do I get if I win?"],
      none: ["How does escrow work?", "How does Heirloom work?"],
    },
    agent: {
      Active: ["Which scheduled payments are due?", "Summarise the estate"],
      DeathPending: ["When can the estate unlock?", "Summarise the estate"],
      Unlocked: ["Which payments are due?", "Rank the car offers", "Summarise the estate"],
      none: ["How does Heirloom work?"],
    },
    guest: ["How does Heirloom work?", "Is this a legal will?", "What stops someone draining the vault?"],
  },
  attachment: {
    sentAlone: "I've attached {name}.",
    reading: "Reading {name}",
    verdict: { approve: "It looks right to me.", reject: "I can't accept this document.", needs_human: "A person should look at this one." },
    report: "I read {name} ({type}, {confidence}% sure). {verdict}\n\n{summary}",
    redFlags: "Things to check: {flags}.",
    next: {
      death: "If this is right, you can report the passing with it. Two trusted people then confirm.",
      claim: "If this is right, you can claim against your rule with it. The money goes straight to the institution.",
      hardship: "If this is right, you can start a hardship request with it. Two trusted people must agree.",
      verifier: "The family member submits it through their own claim; you'll see it in your inbox with this report.",
      other: "Only the family member it concerns can submit it.",
    },
    failed: "I couldn't read {name} just now. Check the file is a clear PDF or photo and try again.",
    types: { death_certificate: "a death certificate", fee_statement: "a fee statement", affidavit: "an affidavit" } as Record<string, string>,
    typeFallback: "a document",
  },
};

export type ChatCopy = typeof en;
type Translations = Partial<Record<Exclude<Locale, "en">, DeepPartial<ChatCopy>>>;

/** Translations go here as they arrive; any missing slot shows in English. */
const translations: Translations = {};

/** Copy for a locale, falling back to English slot by slot. */
export function chatCopy(locale: Locale = "en"): ChatCopy {
  if (locale === "en") return en;
  return mergeCopy(en, translations[locale]);
}

export const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? ""));
