"use client";
/**
 * The chat home. Empty thread: a centred welcome, anything that needs the person's attention, and
 * suggested questions. With messages: the conversation scrolls and the composer stays pinned below it.
 */
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { FileText, ShieldCheck } from "@/components/ui/icons";
import type { ChatThreadMessage } from "@/lib/chat/types";
import { Gate } from "@/components/shell/gate";
import { fmt, useCopy } from "@/components/shell/copy";
import { LogoMark } from "@/components/ui/primitives";
import { Typewriter } from "@/components/ui/client";
import { ActionButtons, Chips, SpecialistChip, Thinking } from "@/components/agent/chat-parts";
import { useChat } from "./chat-context";
import { ChatComposer } from "./chat-composer";
import { NudgeStack } from "./nudge-stack";

export function ChatScreen() {
  return <Gate allowEmpty>{() => <Chat />}</Gate>;
}

const toEnd = () => window.scrollTo({ top: document.documentElement.scrollHeight });

function Chat() {
  const { assistant: copy, siteName } = useCopy();
  const h = copy.home;
  const chat = useChat();
  const messages = chat.active?.messages ?? [];
  const empty = messages.length === 0;
  const last = messages[messages.length - 1];

  // Keep the newest message in view (the page scrolls; the composer is pinned over its bottom edge).
  useEffect(() => { if (!empty) toEnd(); }, [empty, messages.length, chat.busy, chat.activeId]);
  const send = (text: string, opts?: Parameters<typeof chat.send>[1]) => { void chat.send(text, opts); };

  return (
    <div className="mx-auto flex w-full max-w-[56.25rem] flex-1 flex-col px-4">
      {empty ? (
        <div className="flex flex-1 flex-col">
          <NudgeStack className="mx-auto w-full max-w-xl pt-3" />
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6 text-center sm:gap-5 sm:py-8">
            <h1 className="rise rounded-xl border border-ink px-7 py-4 text-display leading-none sm:px-10">{siteName}</h1>
            <p className="rise max-w-xl text-lead text-ink-2" style={{ "--i": 1 } as React.CSSProperties}>{h.subtitle}</p>
            <div className="rise flex max-w-2xl justify-center [&>div]:justify-center max-sm:[&_button:nth-child(n+4)]:hidden" style={{ "--i": 2 } as React.CSSProperties}>
              <Chips items={chat.suggestions} onPick={send} label={copy.chat.suggestionsLabel} disabled={chat.busy} />
            </div>
          </div>
        </div>
      ) : (
        <>
          <h1 className="sr-only">{chat.active?.title || h.conversation}</h1>
          <div role="log" aria-live="polite" aria-relevant="additions" aria-label={h.conversation} className="flex-1">
            <ol className="flex flex-col gap-6 pb-6 pt-4">
              {messages.map((m) => <Message key={m.id} m={m} fresh={!!m.fresh && m.id === last?.id} />)}
              {chat.busy && <Thinking label={copy.chat.thinking} />}
            </ol>
          </div>
        </>
      )}

      <div className="sticky bottom-0 z-20 bg-bg pb-[calc(var(--safe-b)+0.5rem)] pt-2">
        <ChatComposer onSend={send} disabled={chat.busy} />
        <p className="mt-1.5 flex items-center justify-center gap-1 text-center text-[0.75rem] text-ink-2">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />{copy.chat.disclaimer}
        </p>
      </div>
    </div>
  );
}

function Message({ m, fresh }: { m: ChatThreadMessage; fresh: boolean }) {
  const { assistant: copy } = useCopy();
  const [typed, setTyped] = useState(!fresh);

  if (m.role === "user") {
    return (
      <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex flex-col items-end gap-1.5">
        {m.attachment && (
          <span className="inline-flex max-w-[85%] items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1.5 text-small font-medium">
            <FileText className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{fmt(copy.home.attachment, { name: m.attachment.name })}</span>
          </span>
        )}
        <p className="max-w-[85%] whitespace-pre-line break-words rounded-[1.25rem] rounded-br-md bg-ink px-4 py-2.5 text-bg">
          <span className="sr-only">{copy.chat.you}: </span>{m.text}
        </p>
      </motion.li>
    );
  }

  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex items-start gap-3">
      <LogoMark className="size-8 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex min-h-8 flex-wrap items-center gap-2">
          <span className="text-small font-semibold">{copy.chat.agent}</span>
          {m.specialist && m.specialist !== "Orchestrator" && <SpecialistChip name={m.specialist} copy={copy} />}
        </div>
        <div className="mt-1 break-words">
          <Typewriter text={m.text} active={fresh} onTick={toEnd} onDone={() => { setTyped(true); toEnd(); }} />
        </div>
        {typed && m.actions && m.actions.length > 0 && <ActionButtons actions={m.actions} copy={copy} />}
      </div>
    </motion.li>
  );
}
