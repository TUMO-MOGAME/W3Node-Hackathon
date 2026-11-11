import type { AssistantCopy } from "../assistant";
import type { CommonCopy } from "../common";
import type { LandingCopy } from "../landing";
import type { PayCopy } from "../pay";
import type { ScreensCopy } from "../screens";
import type { SiteCopy } from "../site";
import type { DeepPartial, Widen } from "@/lib/i18n/merge";

/**
 * One language's copy. English (the files in `src/content/`) is the source of truth:
 * - landing, common UI, payments and the site navigation must be translated in full, so a missing
 *   key fails `tsc`;
 * - screens, the agent sheet and the rest of the site chrome may be partial: whatever is left out
 *   shows in English. Unknown keys still fail `tsc`.
 * Not translated on purpose: amounts, USD₮, the product name, people's and institutions' names, the
 * legal pages, and the suggested chat replies (the on-device demo agent matches them in English).
 */
export interface Bundle {
  landing: Widen<LandingCopy>;
  common: Widen<CommonCopy>;
  pay: Widen<PayCopy>;
  site: { nav: Widen<SiteCopy["nav"]> } & DeepPartial<Omit<SiteCopy, "nav">>;
  screens: DeepPartial<ScreensCopy>;
  assistant: DeepPartial<AssistantCopy>;
  /** One line shown above the English-only legal pages. */
  legalNote: string;
}
