import type { Metadata } from "next";
import { screens } from "@/content/screens";
import { ClaimsScreen } from "@/components/screens/claims";

export const metadata: Metadata = { title: screens.claims.eyebrow, robots: { index: false } };

export default function Page() {
  return <ClaimsScreen copy={screens.claims} />;
}
