/**
 * Pure state for saved chats: a reducer, title derivation, caps, and localStorage persistence per persona.
 * The hook in ./threads.ts wires this to React and the assistant pipeline.
 */
import type { ChatThread, ChatThreadMessage } from "./types";

export const MAX_THREADS = 30;
export const MAX_MESSAGES = 200;
export const TITLE_MAX = 40;
/** Placeholder title until the first user message arrives. */
export const NEW_CHAT_TITLE = "New chat";
const STORE_VERSION = 1;
const KEY_PREFIX = `heirloom.chats.v${STORE_VERSION}.`;

export interface ThreadState { threads: ChatThread[]; activeId: string | null }
export const emptyThreadState: ThreadState = { threads: [], activeId: null };

export type NewMessage = Omit<ChatThreadMessage, "id">;

export type ThreadAction =
  | { type: "hydrate"; state: ThreadState }
  | { type: "new"; id: string; now: number }
  | { type: "select"; id: string }
  | { type: "rename"; id: string; title: string }
  | { type: "remove"; id: string }
  /** Appends to a thread (creating it if missing). Earlier messages lose `fresh`; the first user message names an untitled thread. */
  | { type: "append"; id: string; messages: NewMessage[]; now: number };

/** First user message, whitespace collapsed, cut to 40 characters on a word boundary where possible. */
export function deriveTitle(text: string, max = TITLE_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return NEW_CHAT_TITLE;
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space >= max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

const byNewest = (a: ChatThread, b: ChatThread) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt;

/** Keeps the newest MAX_THREADS threads (the active one always survives) and the last MAX_MESSAGES of each. */
export function capState(s: ThreadState): ThreadState {
  let threads = [...s.threads].sort(byNewest).map((t) => (t.messages.length > MAX_MESSAGES ? { ...t, messages: t.messages.slice(-MAX_MESSAGES) } : t));
  if (threads.length > MAX_THREADS) {
    const keep = threads.slice(0, MAX_THREADS);
    const active = threads.find((t) => t.id === s.activeId);
    if (active && !keep.includes(active)) keep[MAX_THREADS - 1] = active;
    threads = keep.sort(byNewest);
  }
  const activeId = threads.some((t) => t.id === s.activeId) ? s.activeId : null;
  return { threads, activeId };
}

const blankThread = (id: string, now: number): ChatThread => ({ id, title: NEW_CHAT_TITLE, createdAt: now, updatedAt: now, messages: [] });

export function threadReducer(s: ThreadState, a: ThreadAction): ThreadState {
  switch (a.type) {
    case "hydrate":
      return capState(a.state);
    case "new":
      if (s.threads.some((t) => t.id === a.id)) return { ...s, activeId: a.id };
      return capState({ threads: [blankThread(a.id, a.now), ...s.threads], activeId: a.id });
    case "select":
      return s.threads.some((t) => t.id === a.id) ? { ...s, activeId: a.id } : s;
    case "rename": {
      const title = a.title.replace(/\s+/g, " ").trim().slice(0, 80);
      if (!title) return s;
      return { ...s, threads: s.threads.map((t) => (t.id === a.id ? { ...t, title } : t)) };
    }
    case "remove": {
      const threads = s.threads.filter((t) => t.id !== a.id);
      return { threads, activeId: s.activeId === a.id ? null : s.activeId };
    }
    case "append": {
      const existing = s.threads.find((t) => t.id === a.id) ?? blankThread(a.id, a.now);
      let nextId = existing.messages.reduce((m, x) => Math.max(m, x.id), 0);
      const added = a.messages.map((m) => ({ ...m, id: ++nextId }));
      const firstUser = added.find((m) => m.role === "user");
      const untitled = existing.title === NEW_CHAT_TITLE && !existing.messages.some((m) => m.role === "user");
      const thread: ChatThread = {
        ...existing,
        title: untitled && firstUser ? deriveTitle(firstUser.text || firstUser.attachment?.name || "") : existing.title,
        updatedAt: a.now,
        messages: [...existing.messages.map((m) => (m.fresh ? { ...m, fresh: false } : m)), ...added],
      };
      return capState({ threads: [thread, ...s.threads.filter((t) => t.id !== a.id)], activeId: s.activeId });
    }
  }
}

/* ---------- persistence ---------- */

/** Storage key for one persona (wallet address, or "guest"). */
export const storageKey = (persona: string) => `${KEY_PREFIX}${persona || "guest"}`;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const isMessage = (m: unknown): m is ChatThreadMessage => {
  const x = m as ChatThreadMessage;
  return !!x && typeof x === "object" && typeof x.id === "number" && (x.role === "user" || x.role === "agent") && typeof x.text === "string" && typeof x.ts === "number";
};
const isThread = (t: unknown): t is ChatThread => {
  const x = t as ChatThread;
  return !!x && typeof x === "object" && typeof x.id === "string" && typeof x.title === "string"
    && typeof x.createdAt === "number" && typeof x.updatedAt === "number" && Array.isArray(x.messages);
};

/** Reads a persona's chats. Anything unreadable (old version, corrupt JSON, blocked storage) gives an empty list. */
export function loadThreads(storage: StorageLike | null, persona: string): ThreadState {
  try {
    const raw = storage?.getItem(storageKey(persona));
    if (!raw) return emptyThreadState;
    const data = JSON.parse(raw) as { v?: number; threads?: unknown; activeId?: unknown };
    if (data.v !== STORE_VERSION || !Array.isArray(data.threads)) return emptyThreadState;
    const threads = data.threads.filter(isThread).map((t) => ({ ...t, messages: t.messages.filter(isMessage).map((m) => ({ ...m, fresh: false })) }));
    return capState({ threads, activeId: typeof data.activeId === "string" ? data.activeId : null });
  } catch {
    return emptyThreadState;
  }
}

/** Writes a persona's chats (capped). Returns false if storage is unavailable or full. */
export function saveThreads(storage: StorageLike | null, persona: string, s: ThreadState): boolean {
  if (!storage) return false;
  const capped = capState(s);
  const strip = (t: ChatThread): ChatThread => ({ ...t, messages: t.messages.map((m) => { const copy = { ...m }; delete copy.fresh; return copy; }) });
  try {
    storage.setItem(storageKey(persona), JSON.stringify({ v: STORE_VERSION, activeId: capped.activeId, threads: capped.threads.map(strip) }));
    return true;
  } catch {
    // Quota: drop the oldest half and try once more.
    try {
      const half = capped.threads.slice(0, Math.max(1, Math.floor(capped.threads.length / 2)));
      storage.setItem(storageKey(persona), JSON.stringify({ v: STORE_VERSION, activeId: capped.activeId, threads: half.map(strip) }));
      return true;
    } catch {
      return false;
    }
  }
}

/** Short unique id for a thread. */
export function newThreadId(now = Date.now(), rand = Math.random): string {
  return `t${now.toString(36)}${Math.floor(rand() * 1e8).toString(36)}`;
}
