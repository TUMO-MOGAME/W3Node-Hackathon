import type { Metadata } from "next";
import { screens } from "@/content/screens";
import { CarScreen } from "@/components/screens/car";

export const metadata: Metadata = { title: screens.car.eyebrow, robots: { index: false } };

export default function Page() {
  return <CarScreen copy={screens.car} />;
}
