import type { Metadata } from "next";
import { screens } from "@/content/screens";
import { InboxScreen } from "@/components/screens/inbox";

export const metadata: Metadata = { title: screens.inbox.eyebrow, robots: { index: false } };

export default function Page() {
  return <InboxScreen copy={screens.inbox} />;
}
