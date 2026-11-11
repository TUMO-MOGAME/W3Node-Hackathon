import type { Metadata } from "next";
import { screens } from "@/content/screens";
import { WillScreen } from "@/components/screens/will";

export const metadata: Metadata = { title: screens.will.eyebrow, robots: { index: false } };

export default function Page() {
  return <WillScreen copy={screens.will} />;
}
