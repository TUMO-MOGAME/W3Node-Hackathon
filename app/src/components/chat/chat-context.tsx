"use client";
/**
 * One instance of the saved conversations and the "needs your attention" nudges, shared by the sidebar
 * (Chats list), the top bar (attention count) and the chat home. The data comes from lib/chat.
 */
import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useCopy } from "@/components/shell/copy";
import type { ChatThreadsApi, NudgesApi } from "@/lib/chat/types";
import { useChatThreads } from "@/lib/chat/threads";
import { useNudges } from "@/lib/chat/nudges";

const Ctx = createContext<{ threads: ChatThreadsApi; nudges: NudgesApi } | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { assistant } = useCopy();
  const pathname = usePathname();
  const threads = useChatThreads(assistant, pathname);
  const nudges = useNudges();
  return <Ctx.Provider value={{ threads, nudges }}>{children}</Ctx.Provider>;
}

function useChatCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useChat must be used inside <ChatProvider>");
  return v;
}

export const useChat = (): ChatThreadsApi => useChatCtx().threads;
export const useAttention = (): NudgesApi => useChatCtx().nudges;
