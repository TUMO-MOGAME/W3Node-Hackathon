import type { Metadata } from "next";
import { legacy, legacySafety } from "@/content/legacy";
import { LegacyScreen } from "@/components/legacy/legacy-screen";

export const metadata: Metadata = { title: legacy.meta.title, robots: { index: false } };

export default function Page() {
  return <LegacyScreen copy={legacy} safety={legacySafety} />;
}
