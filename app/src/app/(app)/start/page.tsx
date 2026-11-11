import type { Metadata } from "next";
import { screens } from "@/content/screens";
import { StartScreen } from "@/components/screens/start";

export const metadata: Metadata = { title: screens.start.eyebrow, description: screens.start.body, alternates: { canonical: "/start" } };

export default function Page() {
  return <StartScreen copy={screens.start} />;
}
