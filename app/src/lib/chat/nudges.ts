"use client";
/**
 * "Needs your attention" cards for the chat home, derived from the estate snapshot and who is acting
 * (./derive-nudges.ts). Dismissals are remembered per persona in localStorage.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEstate } from "@/lib/hooks/estate";
import { useNow } from "@/lib/hooks/use-now";
import { useLocale } from "@/lib/i18n/client";
import { milestonesFor } from "@/lib/legacy/schema";
import { deriveNudges, loadDismissed, saveDismissed, visibleNudges, type LegacyHint } from "./derive-nudges";
import type { NudgesApi } from "./types";

const storage = (): Storage | null => {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
};

export function useNudges(): NudgesApi {
  const { snap, role, session, fx, service } = useEstate();
  const locale = useLocale();
  const now = useNow(30_000);
  const address = session?.address ?? null;
  const persona = address ?? "guest";
  const [dismissed, setDismissed] = useState<{ persona: string | null; ids: string[] }>({ persona: null, ids: [] });
  const [legacy, setLegacy] = useState<{ key: string; hint: LegacyHint | null } | null>(null);

  // Storage is browser-only, so dismissals load after mount and whenever the acting person changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDismissed({ persona, ids: loadDismissed(storage(), persona) }); }, [persona]);

  // A child's milestone messages live in the Legacy Book; only fetched once fees could have been paid after unlock.
  const estate = snap?.estate.address ?? null;
  const wantsLegacy = role === "beneficiary" && snap?.estate.status === "Unlocked" && !!estate && !!service;
  const legacyKey = `${estate}:${persona}`;
  useEffect(() => {
    if (!wantsLegacy || !service || !estate) return;
    let alive = true;
    service.legacyStatus(estate).then((st) => {
      if (!alive) return;
      const hint: LegacyHint | null = st.book
        ? { calledBy: st.book.calledBy, milestones: milestonesFor(st.book, st.childId).filter((m) => m.kind === "firstFees").map((m) => ({ id: m.id, title: m.title })) }
        : null;
      setLegacy({ key: legacyKey, hint });
    }).catch(() => { if (alive) setLegacy({ key: legacyKey, hint: null }); });
    return () => { alive = false; };
  }, [wantsLegacy, service, estate, legacyKey]);

  const dismiss = useCallback((id: string) => {
    setDismissed((d) => {
      if (d.persona !== persona || d.ids.includes(id)) return d;
      const ids = [...d.ids, id];
      saveDismissed(storage(), persona, ids);
      return { persona, ids };
    });
  }, [persona]);

  const nudges = useMemo(() => {
    if (now === null || dismissed.persona !== persona) return [];
    // Until the Legacy Book has loaded (or if it can't be), no legacy nudge is shown.
    const hint = legacy && legacy.key === legacyKey ? legacy.hint : null;
    const all = deriveNudges(snap, role, now, { address, usdtZar: fx?.usdtZar ?? null, locale, legacy: hint });
    return visibleNudges(all, dismissed.ids);
  }, [now, dismissed, persona, legacy, legacyKey, snap, role, address, fx, locale]);

  return { nudges, dismiss };
}
