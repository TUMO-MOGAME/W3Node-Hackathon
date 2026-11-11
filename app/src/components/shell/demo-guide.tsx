"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Compass, Repeat } from "@/components/ui/icons";
import type { EstateSnapshot } from "@/lib/service";
import type { WalletSession } from "@/lib/types";
import { useWallet } from "@/lib/hooks/wallet-source";
import { useEstate } from "@/lib/hooks/estate";
import type { CommonCopy } from "@/content/common";
import { fmt, useCopy } from "./copy";

type StepKey = keyof CommonCopy["demo"]["steps"];
const ORDER: StepKey[] = ["will", "fund", "schedule", "car", "report", "attest", "wait", "claim", "approve", "list", "offer", "settle", "done"];

interface Step { key: StepKey; actor: WalletSession | null; href: string; vars?: Record<string, number> }

function nextStep(snap: EstateSnapshot | null, sessions: WalletSession[]): Step {
  const by = (role: WalletSession["role"]) => sessions.filter((s) => s.role === role);
  const owner = by("owner")[0] ?? null;
  if (!snap) return { key: "will", actor: owner, href: "/will" };
  const e = snap.estate;
  const ownerS = sessions.find((s) => s.address === e.owner) ?? owner;
  const kid = sessions.find((s) => snap.beneficiaries.some((b) => b.wallet === s.address)) ?? by("beneficiary")[0] ?? null;
  const verifier = (i: number) => sessions.find((s) => s.address === e.verifiers[i]) ?? null;
  const buyer = by("buyer")[0] ?? null;
  const car = snap.assets[0];
  if (e.status === "Active") {
    if (e.vaultBalance === BigInt(0)) return { key: "fund", actor: ownerS, href: "/vault" };
    if (!e.death.certHash && snap.rules.some((r) => r.startsNow && r.recurringAmount > BigInt(0) && r.spentTotal === BigInt(0))) return { key: "schedule", actor: ownerS, href: "/estate" };
    if (!car) return { key: "car", actor: ownerS, href: "/car" };
    if (!e.death.certHash) return { key: "report", actor: kid, href: "/family" };
    const i = e.death.attestations.findIndex((a) => !a);
    return { key: "attest", actor: verifier(Math.max(0, i)), href: "/inbox", vars: { got: e.death.attestations.filter(Boolean).length, need: e.deathThreshold } };
  }
  if (e.status === "DeathPending") return { key: "wait", actor: kid, href: "/family" };
  if (snap.claims.length === 0) return { key: "claim", actor: kid, href: "/claims" };
  const open = snap.claims.find((c) => c.status === "Open");
  if (open) return { key: "approve", actor: verifier(Math.max(0, open.approvals.findIndex((a) => !a))), href: "/inbox" };
  if (car?.status === "Held") return { key: "list", actor: verifier(0), href: "/car" };
  if (car?.status === "Listed") {
    const mine = buyer && snap.offers.some((o) => o.buyer === buyer.address);
    return mine ? { key: "settle", actor: verifier(0), href: "/car" } : { key: "offer", actor: buyer, href: "/car" };
  }
  return { key: "done", actor: null, href: "/estate" };
}

/** A one-line guide under the header in demo mode: what happens next, and who does it. */
export function DemoGuide() {
  const { common } = useCopy();
  const d = common.demo;
  const wallet = useWallet();
  const { snap, session, phase, setProofOpen } = useEstate();
  const pathname = usePathname();
  if (phase === "loading" || phase === "error") return null;
  const step = nextStep(snap, wallet.sessions);
  const copy = d.steps[step.key];
  const n = ORDER.indexOf(step.key) + 1;
  const wrongPerson = step.actor && step.actor.address !== session?.address;
  const wrongPage = pathname !== step.href;
  const first = step.actor?.label.replace(/\s*\(.*\)$/, "").replace(/^(Adv\.|Ms\.|Mr\.|Uncle)\s+/i, (m) => m) ?? "";
  const pill = "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 text-small font-semibold text-bg";

  return (
    <div className="brand-panel">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-1.5" role="status" aria-live="polite">
        <Compass className="hidden size-5 shrink-0 sm:block" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.7rem] font-semibold uppercase tracking-wider text-ink-2">
            {d.guideLabel}{step.key !== "done" && <> · {fmt(d.stepOf, { n, total: ORDER.length - 1 })}</>}
          </p>
          <p className="truncate text-small font-semibold" title={copy.body}>{fmt(copy.title, step.vars ?? {})}</p>
        </div>
        {step.key === "done" ? (
          <button type="button" onClick={() => setProofOpen(true)} className={pill}>{common.proof.open}<ArrowRight className="size-4" aria-hidden="true" /></button>
        ) : wrongPerson && step.actor ? (
          <button type="button" onClick={() => wallet.switchTo(step.actor!.address)} className={pill}>
            <Repeat className="size-4" aria-hidden="true" />
            <span className="max-w-[9.5rem] truncate">{fmt(d.switchTo, { name: first.split(" ").slice(0, 2).join(" ") })}</span>
          </button>
        ) : wrongPage ? (
          <Link href={step.href} className={pill}>{d.go}<ArrowRight className="size-4" aria-hidden="true" /></Link>
        ) : null}
      </div>
    </div>
  );
}
