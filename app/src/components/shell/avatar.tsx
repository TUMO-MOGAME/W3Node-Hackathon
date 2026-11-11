import clsx from "clsx";
import type { Role } from "@/lib/types";

const roleTint: Record<Role, string> = {
  // Monochrome: roles differ by fill and outline, never by colour.
  owner: "bg-ink text-bg",
  beneficiary: "border-2 border-ink bg-surface text-ink",
  verifier: "border border-line-strong bg-surface-2 text-ink",
  buyer: "border border-line-strong bg-surface text-ink-2",
  agent: "rounded-md! bg-ink text-bg",
};

/** A person's initial in a disc. */
export function Avatar({ name, role, className }: { name: string; role: Role; className?: string }) {
  const clean = name.replace(/^(Adv\.|Ms\.|Mr\.|Mrs\.|Dr\.|Uncle|Aunt|Pastor)\s+/i, "");
  return (
    <span aria-hidden="true" className={clsx("grid size-9 shrink-0 place-items-center rounded-full text-small font-bold", roleTint[role], className)}>
      {clean[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
