import type { Metadata } from "next";
import { screens } from "@/content/screens";
import { VaultScreen } from "@/components/screens/vault";

export const metadata: Metadata = { title: screens.vault.eyebrow, robots: { index: false } };

export default function Page() {
  return <VaultScreen copy={screens.vault} />;
}
