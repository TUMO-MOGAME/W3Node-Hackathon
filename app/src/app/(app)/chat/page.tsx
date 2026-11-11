import type { Metadata } from "next";
import { assistant } from "@/content/assistant";
import { ChatScreen } from "@/components/chat/chat-screen";

export const metadata: Metadata = { title: assistant.home.eyebrow, robots: { index: false } };

/** The chat home: where the app opens. The copy comes from the shell (already localised there). */
export default function Page() {
  return <ChatScreen />;
}
