import type { Metadata } from "next";
import { screens } from "@/content/screens";
import { PeopleScreen } from "@/components/screens/people";

export const metadata: Metadata = { title: screens.people.eyebrow, robots: { index: false } };

export default function Page() {
  return <PeopleScreen copy={screens.people} />;
}
