import type { Metadata } from "next";
import { screens } from "@/content/screens";
import { EstateScreen } from "@/components/screens/estate";

export const metadata: Metadata = { title: screens.estate.eyebrow, robots: { index: false } };

export default function Page() {
  return <EstateScreen copy={screens.estate} />;
}
