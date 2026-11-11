"use client";
/**
 * Entry points to Legacy Voice, placed on shared screens with one line each (estate, family, claims, agent sheet):
 *  - LegacyEntry: owner "Your voice for them" card; child "Talk with Dad" card (after unlock)
 *  - MilestoneMoment: "Dad left you a message for this moment" when that moment has happened
 *    (first fees: a paid claim to a university for this child)
 *  - LegacySheetLink: "Talk with Dad instead" in the agent sheet
 * Copy comes from the small `legacyEntry` object only.
 */
import { HeartHandshake, Mic } from "@/components/ui/icons";
import { legacyEntry as copy } from "@/content/legacy";
import { useEstate } from "@/lib/hooks/estate";
import { findMoment } from "@/lib/legacy/companion";
import { pronouns } from "@/lib/legacy/prompt";
import type { LegacyStatus } from "@/lib/legacy/schema";
import { ButtonLink, Card } from "@/components/ui/primitives";
import { fmt } from "@/components/shell/copy";
import { DisclosureLabel, PlayButton } from "./parts";
import { useLegacyPlayer } from "./use-player";
import { legacyError, useLegacyStatus } from "./use-legacy";

function vars(s: LegacyStatus | null) {
  const called = s?.book?.calledBy ?? "Dad";
  const p = pronouns(s?.book?.pronoun ?? "he");
  return { called, pronoun: p.subject, possessive: p.possessive };
}

export function LegacyEntry() {
  const { role, snap } = useEstate();
  const { status, passive } = useLegacyStatus({ passive: true });
  if (!snap || (!status && !passive) || (role !== "owner" && role !== "beneficiary")) return null;
  const v = vars(status);
  if (role === "owner") {
    const ready = Boolean(status?.voice);
    return (
      <Card className="flex flex-wrap items-center gap-3 border-ink">
        <span className="grid size-11 shrink-0 place-items-center rounded-full border border-ink text-ink" aria-hidden="true"><Mic className="size-5" /></span>
        <div className="min-w-0 flex-1 basis-48">
          <h2 className="text-body font-semibold">{copy.ownerTitle}</h2>
          <p className="text-small text-ink-2">{ready ? copy.ownerReady : copy.ownerBody}</p>
        </div>
        <ButtonLink href="/legacy" small variant={ready ? "secondary" : "primary"}>{ready ? copy.ownerReadyCta : copy.ownerCta}</ButtonLink>
      </Card>
    );
  }
  // Passive (live network, not visited yet): we can't know if a voice exists without a signature, so offer the door.
  if (status ? !status.voice : snap.estate.status !== "Unlocked") return null;
  const unlocked = status ? status.unlocked : true;
  return (
    <Card className="flex flex-wrap items-center gap-3 border-ink">
      <span className="grid size-11 shrink-0 place-items-center rounded-full border border-ink text-ink" aria-hidden="true"><HeartHandshake className="size-5" /></span>
      <div className="min-w-0 flex-1 basis-48">
        <h2 className="text-body font-semibold">{fmt(copy.childTitle, v)}</h2>
        <p className="text-small text-ink-2">{unlocked ? fmt(status ? copy.childBody : copy.childMaybe, v) : fmt(copy.childLocked, v)}</p>
      </div>
      {unlocked && <ButtonLink href="/legacy" small>{fmt(copy.childCta, v)}</ButtonLink>}
    </Card>
  );
}

export function MilestoneMoment() {
  const { role, snap, session, service, notify } = useEstate();
  const { status, passive } = useLegacyStatus({ passive: true });
  const { play, stop, playing } = useLegacyPlayer(status?.book?.pronoun);
  if (role !== "beneficiary" || !snap || !session || snap.estate.status !== "Unlocked") return null;
  if (status && (!status.voice || !status.unlocked)) return null;
  if (!status && !passive) return null;
  const v = vars(status);
  const uni = new Set(snap.payees.filter((p) => p.kind === "University").map((p) => p.wallet));
  const paid = snap.claims.some((c) => c.beneficiary === session.address && c.status === "Paid" && uni.has(c.payee));
  if (!paid) return null;
  if (!status) {
    return (
      <Card className="border-2 border-ink">
        <h2 className="text-body font-semibold">{fmt(copy.moment.maybe, v)}</h2>
        <ButtonLink href="/legacy" small className="mt-2">{fmt(copy.childCta, v)}</ButtonLink>
      </Card>
    );
  }
  if (!status.optedIn || !status.book) {
    return (
      <Card className="border-2 border-ink">
        <h2 className="text-body font-semibold">{fmt(copy.moment.title, v)}</h2>
        <ButtonLink href="/legacy" small className="mt-2">{fmt(copy.moment.optInFirst, v)}</ButtonLink>
      </Card>
    );
  }
  const child = status.book.children.find((c) => c.id === status.childId) ?? null;
  const m = findMoment(status.book, child, "firstFees");
  if (!m) return null;
  const listen = async () => {
    if (!service) return;
    try { await play(m.id, await service.legacySpeak(snap.estate.address, { milestoneId: m.id })); }
    catch (e) { notify("error", legacyError(e, copy.moment.title)); }
  };
  return (
    <Card className="border-2 border-ink">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-48">
          <h2 className="text-body font-semibold">{fmt(copy.moment.title, v)}</h2>
          <p className="text-small text-ink-2">{m.title}</p>
        </div>
        <PlayButton playing={playing === m.id} onPlay={() => void listen()} onStop={stop} label={fmt(copy.moment.play, v)} stopLabel={copy.moment.stop} />
      </div>
      <DisclosureLabel className="mt-3" text={fmt(copy.moment.label, v)} simulated={Boolean(status.voice?.simulated)} simulatedText={copy.moment.simulated} />
    </Card>
  );
}

export function LegacySheetLink({ onGo }: { onGo?: () => void }) {
  const { role } = useEstate();
  const { snap } = useEstate();
  const { status, passive } = useLegacyStatus({ passive: true });
  if (role !== "beneficiary" || snap?.estate.status !== "Unlocked") return null;
  if (status ? !status.voice : !passive) return null;
  const v = vars(status);
  return (
    <div className="w-full rounded-md border border-ink p-3 text-left">
      <ButtonLink href="/legacy" small variant="secondary" onClick={onGo}><HeartHandshake className="size-4" aria-hidden="true" />{fmt(copy.sheetCta, v)}</ButtonLink>
      <p className="mt-1.5 text-[0.75rem] text-ink-2">{fmt(copy.sheetHint, v)}</p>
    </div>
  );
}
