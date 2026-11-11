"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEstate } from "@/lib/hooks/estate";
import type { LegacyStatus } from "@/lib/legacy/schema";

/** Strips the "Code: " prefix the mock uses, and turns fetch failures into a readable sentence. */
export function legacyError(e: unknown, fallback: string): string {
  const m = e instanceof Error ? e.message : String(e ?? "");
  const clean = m.replace(/^[A-Za-z]+: /, "").trim();
  return clean && !/failed to fetch|network/i.test(clean) ? clean : fallback;
}

/** Last status per estate + wallet, so entry cards can show it without asking the wallet to sign again. */
const cache = new Map<string, LegacyStatus>();

/**
 * Legacy status for whoever is acting, reloaded when the person or the estate's status changes.
 * `passive` (entry cards on shared screens): on the live network every status read is wallet-signed, which can
 * prompt for the PIN, so passive callers only use the cached status from a visit to /legacy and never sign.
 */
export function useLegacyStatus({ passive = false }: { passive?: boolean } = {}) {
  const { service, snap, session } = useEstate();
  const estate = snap?.estate.address ?? null;
  const estateStatus = snap?.estate.status ?? null;
  const who = session?.address ?? null;
  const key = `${estate}|${who}`;
  const [fetched, setFetched] = useState<{ key: string; status: LegacyStatus } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const quiet = passive && service?.mode === "chain";

  const store = useCallback((k: string, s: LegacyStatus) => { cache.set(k, s); setFetched({ key: k, status: s }); setError(null); }, []);

  const reload = useCallback(async () => {
    if (!service || !estate || !who) return;
    const n = ++seq.current;
    try {
      const s = await service.legacyStatus(estate);
      if (n === seq.current) store(key, s);
    } catch (e) {
      if (n === seq.current) setError(legacyError(e, "Could not load the legacy voice."));
    }
  }, [service, estate, who, key, store]);

  useEffect(() => {
    if (!service || !estate || !who || quiet) return;
    const n = ++seq.current;
    service.legacyStatus(estate)
      .then((s) => { if (n === seq.current) store(key, s); })
      .catch((e) => { if (n === seq.current) setError(legacyError(e, "Could not load the legacy voice.")); });
  }, [service, estate, who, estateStatus, quiet, key, store]);

  const status = fetched?.key === key ? fetched.status : cache.get(key) ?? null;
  return { status, error, reload, estate, passive: quiet };
}
