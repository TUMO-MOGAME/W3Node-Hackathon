"use client";
/**
 * Saved chats for the chat-first shell. Each persona (the acting wallet) has its own history in
 * localStorage; messages go through the same assistant pipeline as the agent sheet (./pipeline.ts),
 * and an attached document is read by the document reviewer first.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { assistant, type AssistantCopy } from "@/content/assistant";
import { useEstate } from "@/lib/hooks/estate";
import { useLocale } from "@/lib/i18n/client";
import { attachmentKind, attachmentReply, reviewContext, reviewPurpose, suggestionsFor } from "./attachment";
import { chatCopy, fill } from "./nudge-copy";
import { runAssistantTurn, turnText } from "./pipeline";
import {
  emptyThreadState, loadThreads, newThreadId, saveThreads, threadReducer,
  type NewMessage, type ThreadAction, type ThreadState,
} from "./thread-store";
import type { ChatAttachment, ChatThreadsApi } from "./types";

type Held = ThreadState & { persona: string | null };
type HeldAction = ThreadAction | { type: "load"; persona: string; state: ThreadState };

function heldReducer(s: Held, a: HeldAction): Held {
  if (a.type === "load") return { ...threadReducer(emptyThreadState, { type: "hydrate", state: a.state }), persona: a.persona };
  return { ...threadReducer(s, a), persona: s.persona };
}

const storage = (): Storage | null => {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
};

/**
 * @param copy The assistant copy (localised by the caller); defaults to English.
 * @param page The current route, passed to the orchestrator as context.
 */
export function useChatThreads(copy: AssistantCopy = assistant, page = "/"): ChatThreadsApi {
  const { service, isMock, snap, fx, session, role } = useEstate();
  const locale = useLocale();
  const persona = session?.address ?? "guest";
  const [held, dispatch] = useReducer(heldReducer, { ...emptyThreadState, persona: null });
  const [busyIds, setBusyIds] = useState<string[]>([]);

  const ctx = useRef({ service, isMock, snap, fx, session, role, page, locale, persona, held });
  useEffect(() => { ctx.current = { service, isMock, snap, fx, session, role, page, locale, persona, held }; });

  // Load this persona's chats whenever the acting person changes (storage is browser-only, so after mount).
  useEffect(() => { dispatch({ type: "load", persona, state: loadThreads(storage(), persona) }); }, [persona]);

  // Save after every change, once the current persona's chats have been loaded.
  useEffect(() => {
    if (held.persona) saveThreads(storage(), held.persona, held);
  }, [held]);

  /** Applies an action to a persona's chats: in memory if they're still acting, else straight to storage. */
  const applyFor = useCallback((who: string, action: ThreadAction) => {
    if (ctx.current.persona === who && ctx.current.held.persona === who) { dispatch(action); return; }
    const st = storage();
    saveThreads(st, who, threadReducer(loadThreads(st, who), action));
  }, []);

  const newThread = useCallback(() => {
    const { held: h } = ctx.current;
    const active = h.threads.find((t) => t.id === h.activeId);
    if (active && active.messages.length === 0) return active.id; // reuse an empty chat instead of piling them up
    const id = newThreadId();
    dispatch({ type: "new", id, now: Date.now() });
    return id;
  }, []);

  const select = useCallback((id: string) => dispatch({ type: "select", id }), []);
  const rename = useCallback((id: string, title: string) => dispatch({ type: "rename", id, title }), []);
  const remove = useCallback((id: string) => dispatch({ type: "remove", id }), []);

  const send = useCallback<ChatThreadsApi["send"]>(async (text, opts) => {
    const trimmed = text.trim();
    const file = opts?.attachment;
    if (!trimmed && !file) return;
    const c = ctx.current;
    const who = c.persona;
    const cc = chatCopy(c.locale);
    const now = Date.now();
    let id = c.held.activeId;
    const thread = c.held.threads.find((t) => t.id === id);
    if (!id || !thread) {
      id = newThreadId(now);
      dispatch({ type: "new", id, now });
    }
    const threadId = id;
    const history = (thread?.messages ?? []).map((m) => ({ role: m.role, text: m.text }));
    const attachment: ChatAttachment | undefined = file ? { name: file.name, kind: attachmentKind(file), purpose: opts?.purpose ?? "general" } : undefined;
    dispatch({ type: "append", id: threadId, now, messages: [{ role: "user", text: trimmed || fill(cc.attachment.sentAlone, { name: file?.name ?? "" }), ts: now, attachment }] });
    setBusyIds((b) => [...b, threadId]);

    let reply: NewMessage;
    try {
      if (file) {
        const purpose = reviewPurpose(opts?.purpose, trimmed, file.name);
        if (!c.service) throw new Error("no service");
        const report = await c.service.reviewDocument({ file, purpose, context: reviewContext(c.snap, c.session?.address ?? null, purpose, trimmed) });
        const r = attachmentReply(report, { name: file.name, purpose, role: c.role, snap: c.snap, address: c.session?.address ?? null }, c.locale);
        reply = { role: "agent", specialist: "DocumentReviewer", text: r.text, actions: r.actions, fresh: true, ts: Date.now() };
      } else {
        const r = await runAssistantTurn(trimmed, history, c, copy);
        reply = { role: "agent", specialist: r.reply.specialist, text: turnText(r, copy), actions: r.reply.actions, fresh: true, ts: Date.now() };
      }
    } catch {
      reply = { role: "agent", specialist: "DocumentReviewer", text: fill(cc.attachment.failed, { name: file?.name ?? "" }), fresh: true, ts: Date.now() };
    }
    applyFor(who, { type: "append", id: threadId, now: reply.ts, messages: [reply] });
    setBusyIds((b) => b.filter((x) => x !== threadId));
  }, [copy, applyFor]);

  const ready = held.persona === persona;
  const threads = ready ? held.threads : emptyThreadState.threads;
  const activeId = ready ? held.activeId : null;
  const active = threads.find((t) => t.id === activeId) ?? null;
  const status = snap?.estate.status ?? null;
  const suggestions = useMemo(() => suggestionsFor(role, status, locale), [role, status, locale]);

  return {
    threads, activeId, active,
    busy: !!activeId && busyIds.includes(activeId),
    newThread, select, rename, remove, send, suggestions,
  };
}
