import type { Metadata } from "next";
import { screens } from "@/content/screens";
import { FamilyScreen } from "@/components/screens/family";

export const metadata: Metadata = { title: screens.family.eyebrow, robots: { index: false } };

export default function Page() {
  return <FamilyScreen copy={screens.family} />;
}
