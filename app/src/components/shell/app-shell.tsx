"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { MotionConfig } from "motion/react";
import { FileCheck2, HandCoins, House, Inbox, Menu, MessageCircle, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { CommonCopy } from "@/content/common";
import type { AssistantCopy } from "@/content/assistant";
import type { PayCopy } from "@/content/pay";
import { ConnectionBars, PaymentProvider } from "@/components/pay/payment";
import { EstateProvider, useEstate } from "@/lib/hooks/estate";
import { LogoMark } from "@/components/ui/primitives";
import { Toaster } from "@/components/ui/client";
import { AgentSheet } from "@/components/agent/agent-sheet";
import { AgentActionBridge } from "@/components/agent/chat-parts";
import { ChatProvider, useAttention } from "@/components/chat/chat-context";
import { Avatar } from "./avatar";
import { CopyProvider, fmt, useCopy } from "./copy";
import { PinGate } from "./pin-gate";
import { PersonaSheet } from "./persona-sheet";
import { ProofDrawer } from "./proof-drawer";
import { DemoGuide } from "./demo-guide";
import { Sidebar } from "./sidebar";
import { applyTheme, useTheme } from "./theme";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { useLocalized } from "@/lib/i18n/client";

export { Avatar } from "./avatar";

const COLLAPSE_KEY = "heirloom.sidebar";

export function AppShell({ common: commonEn, assistant: assistantEn, pay: payEn, siteName, children }: { common: CommonCopy; assistant: AssistantCopy; pay: PayCopy; siteName: string; children: ReactNode }) {
  // English is passed from the server; the visitor's language (if any) is laid over it in the browser.
  const common = useLocalized(commonEn, (t) => t.common);
  const assistant = useLocalized(assistantEn, (t) => t.assistant);
  const pay = useLocalized(payEn, (t) => t.pay);
  return (
    <CopyProvider value={{ common, assistant, pay, siteName }}>
      <MotionConfig reducedMotion="user">
        <PinGate>
          <EstateProvider errors={common.errors}>
            <PaymentProvider><ChatProvider><Chrome>{children}</Chrome></ChatProvider></PaymentProvider>
          </EstateProvider>
        </PinGate>
      </MotionConfig>
    </CopyProvider>
  );
}

const roundBtn = "relative grid size-11 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-ink transition-colors hover:bg-surface-2";

function CountDot({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span aria-hidden="true" className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-ink px-1 text-[0.7rem] font-bold leading-5 text-bg ring-2 ring-bg">{n}</span>;
}

/**
 * The frame every in-app page shares. Signed in: a sidebar (panel or icon rail on desktop, drawer on phones and tablets),
 * a slim top bar, and the page. The chat home (/chat) fills the main area; other pages sit in a centred column.
 * Onboarding and signed-out visitors get the top bar only.
 */
function Chrome({ children }: { children: ReactNode }) {
  const { common, assistant, siteName } = useCopy();
  const s = assistant.shell;
  const { session, role, snap, isMock, setProofOpen } = useEstate();
  const { nudges } = useAttention();
  const pathname = usePathname();
  const { theme } = useTheme();
  const [personaOpen, setPersonaOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const onboarding = pathname.startsWith("/start");
  const framed = !onboarding && !!session;
  const isChat = pathname === "/chat";
  const inboxCount = role === "verifier" && snap ? pendingFor(snap, session?.address ?? "") : 0;
  const ownerCount = role === "owner" && snap ? ownerPending(snap) : 0;

  // Apply the saved appearance choice (system is the default and needs no attribute).
  useEffect(() => { applyTheme(theme); }, [theme]);

  // The collapse choice is remembered on this device; read after mount so the server markup matches.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "collapsed"); } catch { /* ignore */ }
  }, []);
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { window.localStorage.setItem(COLLAPSE_KEY, next ? "collapsed" : "open"); } catch { /* ignore */ }
  };

  // Phone drawer: a native modal dialog, so focus is trapped, Esc closes it and the page behind is inert.
  useEffect(() => {
    const d = drawer.current;
    if (!d) return;
    if (drawerOpen && !d.open) d.showModal();
    if (!drawerOpen && d.open) d.close();
  }, [drawerOpen]);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  useEffect(() => {
    // The drawer is a phone pattern: close it if the window grows into the desktop layout.
    const mq = window.matchMedia("(min-width: 1280px)");
    const on = () => { if (mq.matches) setDrawerOpen(false); };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const badges = { inbox: inboxCount, claims: ownerCount };
  const openPersona = () => setPersonaOpen(true);
  const personaLabel = session ? fmt(common.persona.switchLabel, { name: session.label.replace(/\s*\(.*\)$/, ""), role: common.roles[session.role] }) : "";
  // --tabbar-h is the height of whatever is pinned to the bottom of the screen (the chat composer), so toasts clear it.
  const vars = { "--sidebar-w": collapsed ? "5.25rem" : "18.25rem", "--tabbar-h": framed && isChat ? "11.5rem" : "0rem" } as CSSProperties;

  return (
    <div className="min-h-dvh" style={vars}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2.5 focus:text-accent-ink">{common.nav.skip}</a>

      {framed && (
        <>
          {/* Wide screens: the full panel, collapsible to an icon rail. */}
          <aside aria-label={s.sidebarLabel} className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] py-3 pl-3 xl:block">
            <div className="h-full overflow-hidden rounded-xl border border-line-strong bg-surface">
              <Sidebar rail={collapsed} badges={badges} onPersona={openPersona} />
            </div>
          </aside>
          {/* Small laptops and tablets: always the rail, so pages keep their width; the menu button opens the full list. */}
          <aside aria-label={s.sidebarLabel} className="fixed inset-y-0 left-0 z-30 hidden w-[5.25rem] py-3 pl-3 lg:block xl:hidden">
            <div className="h-full overflow-hidden rounded-xl border border-line-strong bg-surface">
              <Sidebar rail badges={badges} onPersona={openPersona} />
            </div>
          </aside>
        </>
      )}

      <div className={clsx("flex min-h-dvh min-w-0 flex-col", framed && "lg:pl-[5.25rem] xl:pl-[var(--sidebar-w)]")}>
        <header className={clsx("pt-safe sticky top-0 z-40 border-ink bg-bg", framed ? "border-b lg:border-b-0" : "border-b")}>
          <div className={clsx("flex h-[var(--header-h)] w-full items-center gap-2", framed ? "px-3 lg:px-4" : "mx-auto max-w-6xl px-4")}>
            {framed ? (
              <>
                <button type="button" onClick={() => setDrawerOpen(true)} aria-label={s.openMenu} aria-haspopup="dialog" aria-expanded={drawerOpen} className={clsx(roundBtn, "xl:hidden")}>
                  <Menu className="size-5" aria-hidden="true" />
                </button>
                <Link href="/chat" aria-label={common.nav.home} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full lg:hidden">
                  <LogoMark className="size-9" />
                  <span className="hidden font-display text-[1.375rem] leading-none min-[400px]:inline">{siteName}</span>
                </Link>
                <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? s.expand : s.collapse} aria-expanded={!collapsed} title={collapsed ? s.expand : s.collapse} className={clsx(roundBtn, "hidden xl:grid")}>
                  {collapsed ? <PanelLeftOpen className="size-5" aria-hidden="true" /> : <PanelLeftClose className="size-5" aria-hidden="true" />}
                </button>
              </>
            ) : (
              <Link href={session ? "/chat" : "/"} aria-label={common.nav.home} className="flex shrink-0 items-center gap-2 rounded-full pr-1">
                <LogoMark className="size-9" />
                <span className="hidden font-display text-[1.375rem] leading-none sm:inline">{siteName}</span>
              </Link>
            )}

            <div className="ml-auto flex min-w-0 items-center gap-2">
              {!framed && <LanguageSwitcher />}
              {!framed && isMock && (
                <button type="button" onClick={openPersona} title={common.demo.badgeHint} aria-label={common.demo.open} className="hidden min-h-11 shrink-0 items-center rounded-full px-1 min-[440px]:inline-flex">
                  <span className="rounded-full border border-dashed border-ink px-2.5 py-1 text-[0.75rem] font-semibold text-ink">{common.demo.badge}</span>
                </button>
              )}
              {framed && (
                <>
                  <Link href="/chat" aria-current={isChat ? "page" : undefined} aria-label={nudges.length ? fmt(s.top.homeCount, { n: nudges.length }) : s.top.home} title={s.top.home} className={clsx(roundBtn, isChat && "border-ink")}>
                    <House className="size-5" aria-hidden="true" /><CountDot n={nudges.length} />
                  </Link>
                  <button type="button" onClick={() => setProofOpen(true)} aria-label={common.proof.openLabel} title={common.proof.open} className={clsx(roundBtn, "hidden min-[400px]:grid")}>
                    <FileCheck2 className="size-5" aria-hidden="true" />
                  </button>
                  {role === "verifier" && (
                    <Link href="/inbox" aria-label={inboxCount ? fmt(s.top.inboxCount, { n: inboxCount }) : s.top.inbox} title={s.top.inbox} className={roundBtn}>
                      <Inbox className="size-5" aria-hidden="true" /><CountDot n={inboxCount} />
                    </Link>
                  )}
                  {role === "owner" && ownerCount > 0 && (
                    <Link href="/claims" aria-label={fmt(s.top.claimsCount, { n: ownerCount })} title={s.top.claims} className={roundBtn}>
                      <HandCoins className="size-5" aria-hidden="true" /><CountDot n={ownerCount} />
                    </Link>
                  )}
                </>
              )}
              {session && (
                <button type="button" onClick={openPersona} aria-label={personaLabel} title={personaLabel} className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-surface-2">
                  <Avatar name={session.label} role={session.role} />
                </button>
              )}
            </div>
          </div>
          <ConnectionBars />
          {framed && isMock && <div className="lg:px-4 lg:pb-1"><div className="overflow-hidden lg:rounded-xl"><DemoGuide /></div></div>}
        </header>

        <main
          id="main" tabIndex={-1}
          className={clsx("min-w-0 flex-1 outline-none", framed && isChat ? "flex flex-col" : clsx("mx-auto w-full max-w-6xl px-4 pt-5", framed ? "pb-28 lg:pb-16" : "pb-10"))}
        >
          {children}
        </main>
      </div>

      {framed && (
        <>
          {!isChat && pathname !== "/will" && (
            <Link
              href="/chat"
              className="fixed bottom-[calc(var(--safe-b)+0.875rem)] right-4 z-30 inline-flex h-14 items-center gap-2 rounded-full bg-ink pl-4 pr-5 font-semibold text-bg shadow-raised ring-2 ring-bg transition-transform active:scale-95 lg:hidden"
            >
              <MessageCircle className="size-6" aria-hidden="true" />
              <span className="text-small">{assistant.sheet.fabLabel}</span>
            </Link>
          )}
          <dialog
            ref={drawer} className="drawer" aria-label={s.sidebarLabel}
            onClose={closeDrawer}
            onCancel={(e) => { e.preventDefault(); closeDrawer(); }}
            onClick={(e) => { if (e.target === drawer.current) closeDrawer(); }}
          >
            {drawerOpen && <Sidebar badges={badges} onPersona={openPersona} onNavigate={closeDrawer} onClose={closeDrawer} />}
          </dialog>
        </>
      )}

      <PersonaSheet open={personaOpen} onClose={() => setPersonaOpen(false)} />
      <ProofDrawer />
      <AgentSheet />
      <AgentActionBridge />
      <Toaster dismissLabel={common.toast.dismiss} />
    </div>
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
