import type { ReactNode } from "react";
import { assistant } from "@/content/assistant";
import { common } from "@/content/common";
import { site } from "@/content/site";
import { AppShell } from "@/components/shell/app-shell";

/** Everything inside the app shares one shell: wallet, estate data, navigation, the agent and proof. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell common={common} assistant={assistant} siteName={site.name}>{children}</AppShell>;
}
