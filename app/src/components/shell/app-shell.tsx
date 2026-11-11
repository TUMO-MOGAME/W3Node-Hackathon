"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { MotionConfig } from "motion/react";
import { CarFront, ChevronDown, FileCheck2, HandCoins, House, Inbox, Landmark, MessageCircle, Milestone, Phone, ScrollText, Users, type LucideIcon } from "lucide-react";
import type { CommonCopy } from "@/content/common";
import type { AssistantCopy } from "@/content/assistant";
import type { Role } from "@/lib/types";
import { EstateProvider, useEstate } from "@/lib/hooks/estate";
import { LogoMark } from "@/components/ui/primitives";
import { Toaster } from "@/components/ui/client";
import { AgentSheet } from "@/components/agent/agent-sheet";
import { CopyProvider, fmt, useCopy } from "./copy";
import { PinGate } from "./pin-gate";
import { PersonaSheet } from "./persona-sheet";
import { ProofDrawer } from "./proof-drawer";
import { DemoGuide } from "./demo-guide";

type NavKey = "estate" | "will" | "vault" | "car" | "people" | "family" | "claims" | "inbox";
const NAV: Record<NavKey, { href: string; icon: LucideIcon }> = {
  estate: { href: "/estate", icon: House },
  will: { href: "/will", icon: ScrollText },
  vault: { href: "/vault", icon: Landmark },
  car: { href: "/car", icon: CarFront },
  people: { href: "/people", icon: Users },
  family: { href: "/family", icon: Milestone },
  claims: { href: "/claims", icon: HandCoins },
  inbox: { href: "/inbox", icon: Inbox },
};
const TABS: Record<Role | "none", NavKey[]> = {
  owner: ["estate", "will", "vault", "claims", "car"],
  beneficiary: ["estate", "family", "claims", "car"],
  verifier: ["estate", "inbox", "family", "car"],
  buyer: ["car", "estate"],
  agent: ["estate", "car"],
  none: ["estate"],
};

export function AppShell({ common, assistant, siteName, children }: { common: CommonCopy; assistant: AssistantCopy; siteName: string; children: ReactNode }) {
  return (
    <CopyProvider value={{ common, assistant, siteName }}>
      <MotionConfig reducedMotion="user">
        <PinGate>
          <EstateProvider errors={common.errors}>
            <Chrome>{children}</Chrome>
          </EstateProvider>
        </PinGate>
      </MotionConfig>
    </CopyProvider>
  );
}

function Chrome({ children }: { children: ReactNode }) {
  const { common, assistant, siteName } = useCopy();
  const { session, role, snap, isMock, openAgent, setProofOpen } = useEstate();
  const pathname = usePathname();
  const [personaOpen, setPersonaOpen] = useState(false);
  const onboarding = pathname.startsWith("/start");
  const tabs = TABS[role ?? "none"];
  const inboxCount = role === "verifier" && snap ? pendingFor(snap, session?.address ?? "") : 0;
  const ownerCount = role === "owner" && snap ? ownerPending(snap) : 0;

  // Apply a saved appearance choice (system is the default and needs no attribute).
  useEffect(() => {
    try {
      const t = window.localStorage.getItem("heirloom.theme");
      if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
    } catch { /* ignore */ }
  }, []);

  const navLink = (key: NavKey, layout: "tab" | "top") => {
    const { href, icon: Icon } = NAV[key];
    const active = pathname === href || pathname.startsWith(`${href}/`);
    const badge = key === "inbox" ? inboxCount : key === "claims" ? ownerCount : 0;
    return (
      <Link
        key={key} href={href} aria-current={active ? "page" : undefined}
        className={clsx(
          "relative transition-colors",
          layout === "tab"
            ? "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold"
            : "inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-small font-semibold",
          active ? (layout === "tab" ? "text-accent" : "bg-accent-soft text-accent") : "text-ink-2 hover:text-ink",
        )}
      >
        <span className={clsx("relative grid place-items-center", layout === "tab" && "h-7 w-14 rounded-full", layout === "tab" && active && "bg-accent-soft")}>
          <Icon className="size-5" aria-hidden="true" />
          {badge > 0 && <span className="absolute -right-0.5 -top-1 grid min-w-4.5 place-items-center rounded-full bg-danger px-1 text-[0.65rem] font-bold leading-[1.15rem] text-surface">{badge}<span className="sr-only"> </span></span>}
        </span>
        <span className="truncate">{common.nav[key]}</span>
      </Link>
    );
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2.5 focus:text-accent-ink">{common.nav.skip}</a>

      <header className="pt-safe sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-[var(--header-h)] w-full max-w-6xl items-center gap-2 px-4">
          <Link href={session ? "/estate" : "/"} aria-label={common.nav.home} className="flex shrink-0 items-center gap-2 rounded-full pr-1">
            <LogoMark className="size-9" />
            <span className="hidden font-display text-[1.375rem] leading-none sm:inline">{siteName}</span>
          </Link>

          {!onboarding && session && (
            <nav aria-label={common.nav.label} className="ml-4 hidden items-center gap-1 md:flex">
              {tabs.map((k) => navLink(k, "top"))}
            </nav>
          )}

          <div className="ml-auto flex min-w-0 items-center gap-1.5">
            {isMock && (
              <button type="button" onClick={() => setPersonaOpen(true)} title={common.demo.badgeHint} aria-label={common.demo.open} className="hidden min-h-11 shrink-0 items-center rounded-full px-1 min-[440px]:inline-flex">
                <span className="rounded-full bg-brass-soft px-2.5 py-1 text-[0.75rem] font-semibold text-brass">{common.demo.badge}</span>
              </button>
            )}
            {!onboarding && session && (
              <>
                <button type="button" onClick={() => openAgent("chat")} className="hidden min-h-11 shrink-0 items-center gap-2 rounded-full border border-accent/40 bg-surface px-4 text-small font-semibold text-accent hover:bg-accent-soft md:inline-flex">
                  <Phone className="size-4" aria-hidden="true" />{assistant.sheet.headerLabel}
                </button>
                <button type="button" onClick={() => setProofOpen(true)} aria-label={common.proof.openLabel} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-small font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink">
                  <FileCheck2 className="size-5" aria-hidden="true" /><span className="hidden sm:inline">{common.proof.open}</span>
                </button>
              </>
            )}
            {session && (
              <button
                type="button" onClick={() => setPersonaOpen(true)}
                aria-label={fmt(common.persona.switchLabel, { name: session.label, role: common.roles[session.role] })}
                className="flex min-h-11 min-w-0 items-center gap-2 rounded-full border border-line-strong/70 bg-surface py-1 pl-1 pr-2.5 shadow-card hover:bg-surface-2"
              >
                <Avatar name={session.label} role={session.role} />
                <span className="flex min-w-0 flex-col items-start leading-tight">
                  <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-brass">{common.roles[session.role]}</span>
                  <span className="max-w-[7.5rem] truncate text-small font-semibold sm:max-w-[11rem]">{session.label.replace(/\s*\(.*\)$/, "")}</span>
                </span>
                <ChevronDown className="size-4 shrink-0 text-ink-2" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {!onboarding && isMock && session && <DemoGuide />}
      </header>

      <main id="main" tabIndex={-1} className={clsx("mx-auto w-full max-w-6xl flex-1 px-4 pt-5 outline-none", onboarding || !session ? "pb-10" : "pb-[calc(var(--tabbar-h)+var(--safe-b)+5.5rem)] md:pb-16")}>
        {children}
      </main>

      {!onboarding && session && (
        <>
          <button
            type="button" onClick={() => openAgent("chat")}
            className="fixed bottom-[calc(var(--tabbar-h)+var(--safe-b)+0.875rem)] right-4 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-accent pl-4 pr-5 font-semibold text-accent-ink shadow-float transition-transform active:scale-95 md:hidden"
          >
            <MessageCircle className="size-6" aria-hidden="true" />
            <span className="text-small">{assistant.sheet.fabLabel}</span>
          </button>
          <nav aria-label={common.nav.label} className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md md:hidden">
            <div className="mx-auto flex h-[var(--tabbar-h)] max-w-lg items-stretch px-1">{tabs.map((k) => navLink(k, "tab"))}</div>
          </nav>
        </>
      )}

      <PersonaSheet open={personaOpen} onClose={() => setPersonaOpen(false)} />
      <ProofDrawer />
      <AgentSheet />
      <Toaster dismissLabel={common.toast.dismiss} />
    </div>
  );
}

const roleTint: Record<Role, string> = {
  owner: "bg-accent text-accent-ink",
  beneficiary: "bg-brass-soft text-brass",
  verifier: "bg-accent-soft text-accent",
  buyer: "bg-surface-2 text-ink",
  agent: "bg-ink text-bg",
};

export function Avatar({ name, role, className }: { name: string; role: Role; className?: string }) {
  const clean = name.replace(/^(Adv\.|Ms\.|Mr\.|Mrs\.|Dr\.|Uncle|Aunt|Pastor)\s+/i, "");
  return (
    <span aria-hidden="true" className={clsx("grid size-9 shrink-0 place-items-center rounded-full text-small font-bold", roleTint[role], className)}>
      {clean[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/** Living-plan claims the owner still has to approve. */
export function ownerPending(snap: NonNullable<ReturnType<typeof useEstate>["snap"]>): number {
  if (snap.estate.status !== "Active") return 0;
  return snap.claims.filter((c) => c.status === "Open" && c.agentVerdict === "Approved" && snap.rules.find((r) => r.address === c.rule)?.startsNow).length;
}

/** Items a given trusted person still has to act on. */
export function pendingFor(snap: NonNullable<ReturnType<typeof useEstate>["snap"]>, address: string): number {
  const i = snap.estate.verifiers.indexOf(address);
  if (i < 0) return 0;
  const d = snap.estate.death;
  const death = snap.estate.status === "Active" && d.certHash && d.verdict === "Approved" && !d.attestations[i] ? 1 : 0;
  const claims = snap.estate.status === "Unlocked" ? snap.claims.filter((c) => c.status === "Open" && c.agentVerdict === "Approved" && !c.approvals[i]).length : 0;
  const hardships = snap.hardships.filter((h) => h.status === "Open" && h.agentVerdict === "Approved" && !h.approvals[i]).length;
  return death + claims + hardships;
}
