"use client";
/**
 * The sidebar: brand, grouped navigation, saved chats, utilities and the current persona.
 * Rendered three ways from one component: the full panel and the icon rail on desktop, and the
 * off-canvas drawer on phones.
 */
import { useId, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  CarFront, Check, ChevronDown, ChevronsUpDown, Ellipsis, FileCheck2, FlaskConical, HandCoins, House, Inbox, Landmark, LifeBuoy,
  MessageCircle, MessageSquare, Mic, Milestone, Moon, Pencil, Phone, Plus, ScrollText, Send, Trash2, Users, X, type LucideIcon,
} from "@/components/ui/icons";
import type { Role } from "@/lib/types";
import type { ChatThread } from "@/lib/chat/types";
import { shortAddress } from "@/lib/format";
import { useEstate } from "@/lib/hooks/estate";
import { useWallet } from "@/lib/hooks/wallet-source";
import { LogoMark } from "@/components/ui/primitives";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { useChat } from "@/components/chat/chat-context";
import { Avatar } from "./avatar";
import { fmt, useCopy } from "./copy";
import { setTheme, useTheme } from "./theme";

type GroupKey = "plan" | "family" | "trusted" | "money";
interface Item { key: string; href: string; icon: LucideIcon; roles?: Role[] }
const GROUPS: { key: GroupKey; items: Item[] }[] = [
  { key: "plan", items: [
    { key: "will", href: "/will", icon: ScrollText, roles: ["owner"] },
    { key: "vault", href: "/vault", icon: Landmark, roles: ["owner"] },
  ] },
  { key: "family", items: [
    { key: "estate", href: "/estate", icon: House },
    { key: "claims", href: "/claims", icon: HandCoins },
    { key: "family", href: "/family", icon: Milestone },
    { key: "car", href: "/car", icon: CarFront },
    { key: "hardship", href: "/hardship", icon: LifeBuoy },
  ] },
  { key: "trusted", items: [
    { key: "inbox", href: "/inbox", icon: Inbox, roles: ["verifier"] },
    { key: "people", href: "/people", icon: Users },
  ] },
  { key: "money", items: [{ key: "send", href: "/send", icon: Send }] },
];

const row = "relative flex min-h-11 w-full items-center gap-3 rounded-lg text-left text-small transition-colors";
const rowIdle = "font-medium text-ink hover:bg-surface-2";
const rowActive = "bg-ink font-semibold text-bg";
const groupLabel = "px-3 pb-1 pt-4 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-2";

export function Sidebar({
  rail = false, badges, onNavigate, onPersona, onClose,
}: {
  /** Icon-only rail (desktop, collapsed). */
  rail?: boolean;
  badges: { inbox: number; claims: number };
  /** Called after any choice, so the phone drawer can close. */
  onNavigate?: () => void;
  onPersona: () => void;
  /** Present in the phone drawer: shows a close button beside the brand. */
  onClose?: () => void;
}) {
  const { common, assistant, siteName } = useCopy();
  const s = assistant.shell;
  const { session, role, isMock, openAgent, setProofOpen } = useEstate();
  const chat = useChat();
  const pathname = usePathname();
  const router = useRouter();
  const { dark } = useTheme();
  // The role (and so which links show) is known once the wallet has loaded; hide the list until then so it
  // appears in place instead of shifting.
  const { ready } = useWallet();
  const [chatsOpen, setChatsOpen] = useState(true);
  const chatsId = useId();
  const onChat = pathname === "/chat";
  const pad = rail ? "justify-center px-0" : "px-3";
  // In the full panel the visible text is the name; the rail has icons only, so it needs the label.
  const personaLabel = session ? fmt(common.persona.switchLabel, { name: session.label.replace(/\s*\(.*\)$/, ""), role: common.roles[session.role] }) : "";

  const label = (key: string): string =>
    key === "hardship" ? s.nav.hardship : key === "legacy" ? s.nav.legacy : key === "send" ? s.nav.send : common.nav[key as "estate" | "will" | "vault" | "car" | "people" | "family" | "claims" | "inbox"];

  const text = (t: string) => <span className={rail ? "sr-only" : "min-w-0 flex-1 truncate"}>{t}</span>;
  const badge = (n: number, active: boolean) => n > 0 && (
    <span className={clsx("grid min-w-5 place-items-center rounded-full px-1 text-[0.7rem] font-bold leading-5", rail ? "absolute right-0.5 top-0.5 bg-ink text-bg ring-2 ring-surface" : active ? "bg-bg text-ink" : "bg-ink text-bg")}>{n}</span>
  );

  const link = (it: Item) => {
    const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
    const n = it.key === "inbox" ? badges.inbox : it.key === "claims" ? badges.claims : 0;
    return (
      <li key={it.key}>
        <Link
          href={it.href} onClick={onNavigate} aria-current={active ? "page" : undefined} title={rail ? label(it.key) : undefined}
          className={clsx(row, pad, active ? rowActive : rowIdle)}
        >
          <it.icon className="size-5 shrink-0" aria-hidden="true" />
          {text(label(it.key))}
          {badge(n, active)}
        </Link>
      </li>
    );
  };

  const action = (icon: ReactNode, t: string, onClick: () => void, extra?: string) => (
    <li>
      <button type="button" onClick={() => { onClick(); onNavigate?.(); }} title={rail ? t : undefined} className={clsx(row, pad, rowIdle, extra)}>
        {icon}{text(t)}
      </button>
    </li>
  );

  const startChat = () => { chat.newThread(); router.push("/chat"); onNavigate?.(); };
  const openChat = (id: string) => { chat.select(id); router.push("/chat"); onNavigate?.(); };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Brand */}
      <div className={clsx("flex shrink-0 items-center gap-2 pb-2 pt-3", rail ? "justify-center px-2" : "px-3")}>
        <Link href="/chat" onClick={onNavigate} aria-label={rail ? common.nav.home : undefined} title={common.nav.home} className={clsx("flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg", rail && "justify-center")}>
          <LogoMark className="size-9 shrink-0" />
          {!rail && (
            <span className="min-w-0 leading-tight">
              <span className="block font-display text-[1.375rem] leading-none">{siteName}</span>
              <span className="mt-0.5 block truncate text-[0.75rem] text-ink-2">{s.subtitle}</span>
            </span>
          )}
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} aria-label={s.closeMenu} className="grid size-11 shrink-0 place-items-center rounded-full text-ink hover:bg-surface-2">
            <X className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Navigation, chats and utilities scroll together between the brand and the persona card. */}
      <div className={clsx("scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3", rail ? "px-2" : "px-3", !ready && "invisible")}>
        <nav aria-label={common.nav.label}>
          <ul className="flex flex-col gap-0.5">
            <li>
              <Link href="/chat" onClick={onNavigate} aria-current={onChat ? "page" : undefined} title={rail ? s.nav.chat : undefined} className={clsx(row, pad, onChat ? rowActive : rowIdle)}>
                <MessageCircle className="size-5 shrink-0" aria-hidden="true" />{text(s.nav.chat)}
              </Link>
            </li>
          </ul>
          {GROUPS.map((g) => {
            const items = g.items.filter((it) => !it.roles || (role && it.roles.includes(role)));
            if (!items.length) return null;
            return (
              <section key={g.key} aria-label={s.groups[g.key]}>
                {rail ? <hr className="mx-2 my-2 border-line" /> : <p className={groupLabel}>{s.groups[g.key]}</p>}
                <ul className="flex flex-col gap-0.5">{items.map(link)}</ul>
              </section>
            );
          })}
        </nav>

        {/* Chats */}
        {rail ? (
          <>
            <hr className="mx-2 my-2 border-line" />
            <ul className="flex flex-col gap-0.5">{action(<Plus className="size-5 shrink-0" aria-hidden="true" />, s.chats.create, startChat)}</ul>
          </>
        ) : (
          <section aria-label={s.chats.title}>
            <div className="flex items-center pt-3">
              <button
                type="button" onClick={() => setChatsOpen((o) => !o)} aria-expanded={chatsOpen} aria-controls={chatsId} title={s.chats.toggle}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg px-3 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-2 hover:text-ink"
              >
                {s.chats.title}
                <ChevronDown className={clsx("size-4 transition-transform", !chatsOpen && "-rotate-90")} aria-hidden="true" />
              </button>
              <button type="button" onClick={startChat} aria-label={s.chats.create} title={s.chats.create} className="grid size-11 shrink-0 place-items-center rounded-full text-ink hover:bg-surface-2">
                <Plus className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div id={chatsId} hidden={!chatsOpen}>
              {chat.threads.length === 0
                ? <p className="px-3 pb-1 text-small text-ink-2">{s.chats.empty}</p>
                : (
                  <ul className="flex flex-col gap-0.5">
                    {chat.threads.map((t) => (
                      <ThreadRow key={t.id} thread={t} active={onChat && t.id === chat.activeId} onOpen={() => openChat(t.id)} />
                    ))}
                  </ul>
                )}
            </div>
          </section>
        )}

        {/* Utilities */}
        <section aria-label={s.groups.more}>
          {rail ? <hr className="mx-2 my-2 border-line" /> : <p className={groupLabel}>{s.groups.more}</p>}
          <ul className="flex flex-col gap-0.5">
            {action(<Phone className="size-5 shrink-0" aria-hidden="true" />, s.nav.call, () => openAgent("call"))}
            {(role === "owner" || role === "beneficiary") && link({ key: "legacy", href: "/legacy", icon: Mic })}
            {action(<FileCheck2 className="size-5 shrink-0" aria-hidden="true" />, common.nav.proof, () => setProofOpen(true))}
            {isMock && action(<FlaskConical className="size-5 shrink-0" aria-hidden="true" />, s.nav.demo, onPersona, "border border-dashed border-ink")}
            <li>
              <button
                type="button" role="switch" aria-checked={dark} onClick={() => setTheme(dark ? "light" : "dark")} title={rail ? s.nav.darkMode : undefined}
                className={clsx(row, pad, rowIdle)}
              >
                <Moon className="size-5 shrink-0" aria-hidden="true" />
                {text(s.nav.darkMode)}
                {!rail && (
                  <span aria-hidden="true" className={clsx("flex h-6 w-10 shrink-0 items-center rounded-full border border-ink p-0.5 transition-colors", dark ? "justify-end bg-ink" : "justify-start bg-surface")}>
                    <span className={clsx("grid size-4 place-items-center rounded-full", dark ? "bg-bg text-ink" : "bg-ink text-bg")}>{dark && <Check className="size-3" strokeWidth={3} />}</span>
                  </span>
                )}
              </button>
            </li>
            {!rail && <li className="px-1 pt-1.5"><LanguageSwitcher /></li>}
          </ul>
        </section>
      </div>

      {/* Persona */}
      {session && (
        <div className={clsx("shrink-0 border-t border-line", rail ? "p-2" : "p-2.5")}>
          <button
            type="button" onClick={() => { onPersona(); onNavigate?.(); }}
            aria-label={rail ? personaLabel : undefined} title={personaLabel} aria-haspopup="dialog"
            className={clsx("flex min-h-14 w-full items-center gap-2.5 rounded-lg text-left hover:bg-surface-2", rail ? "justify-center" : "px-2")}
          >
            <Avatar name={session.label} role={session.role} />
            {!rail && (
              <>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[0.7rem] font-semibold uppercase tracking-wider text-ink-2">{common.roles[session.role]}</span>
                  <span className="block truncate text-small font-semibold">{session.label.replace(/\s*\(.*\)$/, "")}</span>
                  <span className="block truncate font-mono text-[0.7rem] text-ink-2">{shortAddress(session.address)}</span>
                </span>
                <ChevronsUpDown className="size-4 shrink-0 text-ink-2" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/** One saved chat: open it, or use the options to rename or delete it. */
function ThreadRow({ thread, active, onOpen }: { thread: ChatThread; active: boolean; onOpen: () => void }) {
  const { assistant } = useCopy();
  const c = assistant.shell.chats;
  const chat = useChat();
  const { notify } = useEstate();
  const [mode, setMode] = useState<"idle" | "options" | "rename">("idle");
  const [draft, setDraft] = useState(thread.title);
  const fieldId = useId();
  const title = thread.title || c.create;

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (draft.trim()) chat.rename(thread.id, draft.trim());
    setMode("idle");
  };

  if (mode === "rename") {
    return (
      <li>
        <form onSubmit={save} className="flex flex-col gap-1.5 rounded-lg border border-ink p-2">
          <label htmlFor={fieldId} className="sr-only">{c.renameLabel}</label>
          <input
            id={fieldId} value={draft} maxLength={40} autoFocus onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setMode("idle"); } }}
            className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-small text-ink"
          />
          <div className="flex gap-1.5">
            <button type="submit" className="min-h-11 flex-1 rounded-full bg-ink px-3 text-small font-semibold text-bg">{c.save}</button>
            <button type="button" onClick={() => setMode("idle")} className="min-h-11 flex-1 rounded-full border border-ink px-3 text-small font-semibold">{c.cancel}</button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="group/thread">
      <div className={clsx("flex items-center rounded-lg", active ? "border border-ink bg-surface-2" : "border border-transparent hover:bg-surface-2")}>
        <button type="button" onClick={onOpen} aria-current={active ? "page" : undefined} title={title} className={clsx("flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg pl-3 text-left text-small", active ? "font-semibold" : "font-medium")}>
          <MessageSquare className="size-4 shrink-0 text-ink-2" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{title}</span>
        </button>
        <button
          type="button" onClick={() => setMode(mode === "options" ? "idle" : "options")} aria-expanded={mode === "options"} aria-label={fmt(c.options, { title })}
          className="grid size-11 shrink-0 place-items-center rounded-full text-ink-2 hover:text-ink focus-visible:opacity-100 group-focus-within/thread:opacity-100 group-hover/thread:opacity-100 [@media(hover:hover)]:opacity-0 aria-expanded:opacity-100"
        >
          <Ellipsis className="size-5" aria-hidden="true" />
        </button>
      </div>
      {mode === "options" && (
        <div className="flex gap-1.5 px-1 pb-1.5 pt-1">
          <button type="button" onClick={() => { setDraft(thread.title); setMode("rename"); }} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-ink px-3 text-small font-semibold hover:bg-surface-2">
            <Pencil className="size-4" aria-hidden="true" />{c.rename}
          </button>
          <button type="button" onClick={() => { chat.remove(thread.id); notify("info", c.removed); }} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-ink px-3 text-small font-semibold hover:bg-surface-2">
            <Trash2 className="size-4" aria-hidden="true" />{c.remove}
          </button>
        </div>
      )}
    </li>
  );
}
