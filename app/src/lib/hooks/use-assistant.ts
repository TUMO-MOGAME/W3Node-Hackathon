"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantCopy } from "@/content/assistant";
import { useEstate } from "./estate";
import { normaliseReply, type AssistantMessage, type OrchestratorReply } from "./agent-types";
import { mockOrchestrate } from "./mock-orchestrator";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** General assistant chat. Mock mode answers on-device; chain mode calls the orchestrator and falls back on-device. */
export function useAssistant(copy: AssistantCopy, page: string) {
  const { isMock, service, snap, fx, session, role } = useEstate();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [pending, setPending] = useState(false);
  const id = useRef(0);
  const ctx = useRef({ snap, fx, session, role, page, isMock, ready: !!service });
  useEffect(() => { ctx.current = { snap, fx, session, role, page, isMock, ready: !!service }; });

  const name = session?.label.split(/[ (]/)[0] ?? "";
  const greetKey = role === "agent" || !role ? "none" : role;
  const greeting = copy.greeting[greetKey].replace("{name}", name);
  const person = session?.address ?? "none";

  useEffect(() => {
    // A fresh conversation whenever the acting person changes.
    setMessages([{ id: ++id.current, role: "agent", text: greeting, specialist: "EstateGuide" }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const history = messages;
    setMessages((m) => [...m.map((x) => ({ ...x, fresh: false })), { id: ++id.current, role: "user", text: trimmed }]);
    setPending(true);
    const c = ctx.current;
    const local = (): OrchestratorReply => mockOrchestrate(trimmed, { role: c.role, address: c.session?.address ?? null, snap: c.snap, fx: c.fx }, copy);
    let reply: OrchestratorReply | null = null;
    let fellBack = false;
    if (c.isMock || !c.ready) {
      await sleep(700 + Math.min(900, trimmed.length * 12));
      reply = local();
    } else {
      try {
        const res = await fetch("/api/agent/orchestrate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            history: history.map((m) => ({ role: m.role, text: m.text })),
            persona: c.session ? `${c.session.role}:${c.session.label}` : "guest",
            wallet: c.session?.address,
            estate: c.snap?.estate.address,
            page: c.page,
          }),
        });
        reply = res.ok ? normaliseReply(await res.json()) : null;
      } catch { reply = null; }
      if (!reply) { reply = local(); fellBack = true; }
    }
    const final = reply;
    setMessages((m) => [...m, {
      id: ++id.current, role: "agent", fresh: true, specialist: final.specialist, actions: final.actions,
      text: fellBack ? `${copy.chat.errorFallback}\n\n${final.reply}` : final.reply,
    }]);
    setPending(false);
  }, [messages, copy]);

  const reset = useCallback(() => {
    setMessages([{ id: ++id.current, role: "agent", text: greeting, specialist: "EstateGuide" }]);
  }, [greeting]);

  return { messages, pending, send, reset };
}
