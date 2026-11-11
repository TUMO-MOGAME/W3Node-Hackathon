import type { Metadata } from "next";
import { screens } from "@/content/screens";
import { HardshipScreen } from "@/components/screens/hardship";

export const metadata: Metadata = { title: screens.hardship.eyebrow, robots: { index: false } };

export default function Page() {
  return <HardshipScreen copy={screens.hardship} />;
}
