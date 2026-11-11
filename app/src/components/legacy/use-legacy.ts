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

/** Legacy status for whoever is acting, reloaded when the person or the estate's status changes. */
export function useLegacyStatus() {
  const { service, snap, session } = useEstate();
  const [status, setStatus] = useState<LegacyStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const estate = snap?.estate.address ?? null;
  const estateStatus = snap?.estate.status ?? null;
  const who = session?.address ?? null;

  const reload = useCallback(async () => {
    if (!service || !estate || !who) return;
    const n = ++seq.current;
    try {
      const s = await service.legacyStatus(estate);
      if (n === seq.current) { setStatus(s); setError(null); }
    } catch (e) {
      if (n === seq.current) setError(legacyError(e, "Could not load the legacy voice."));
    }
  }, [service, estate, who]);

  useEffect(() => {
    if (!service || !estate || !who) return;
    const n = ++seq.current;
    service.legacyStatus(estate)
      .then((s) => { if (n === seq.current) { setStatus(s); setError(null); } })
      .catch((e) => { if (n === seq.current) setError(legacyError(e, "Could not load the legacy voice.")); });
  }, [service, estate, who, estateStatus]);

  return { status, error, reload, estate };
}
