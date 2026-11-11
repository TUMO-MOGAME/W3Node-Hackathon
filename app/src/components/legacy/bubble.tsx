"use client";
import type { ReactNode } from "react";
import clsx from "clsx";
import { BookHeart } from "lucide-react";
import type { LegacyCopy } from "@/content/legacy";
import { LogoMark } from "@/components/ui/primitives";

/** One line of a legacy conversation. Heirloom's own lines (safety, refusals) look different from the parent's. */
export function Bubble({ role, text, voice = "parent", source, copy, called, action }: {
  role: "user" | "agent"; text: string; voice?: "parent" | "heirloom"; source?: string; copy: LegacyCopy; called: string; action?: ReactNode;
}) {
  if (role === "user") {
    return (
      <li className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-line rounded-[1.25rem] rounded-br-md bg-accent px-4 py-2.5 text-accent-ink">
          <span className="sr-only">{copy.child.you}: </span>{text}
        </p>
      </li>
    );
  }
  const heirloom = voice === "heirloom";
  return (
    <li className="flex items-start gap-2.5">
      {heirloom
        ? <LogoMark className="mt-6 size-7 shrink-0" />
        : <span className="mt-6 grid size-7 shrink-0 place-items-center rounded-full bg-brass-soft font-display text-small text-brass" aria-hidden="true">{called.slice(0, 1)}</span>}
      <div className="min-w-0 max-w-[88%]">
        <p className="mb-1 flex flex-wrap items-center gap-2 text-small font-semibold">
          <span className={heirloom ? "text-accent" : "text-brass"}>{heirloom ? copy.child.heirloom : called}</span>
          {source === "book" && <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 text-[0.75rem] font-medium text-ink-2"><BookHeart className="size-3" aria-hidden="true" />{copy.child.fromBook}</span>}
        </p>
        <p className={clsx("whitespace-pre-line rounded-[1.25rem] rounded-tl-md px-4 py-2.5", heirloom ? "border border-accent/30 bg-accent-soft" : "border border-brass/25 bg-surface-2/70")}>{text}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </li>
  );
}
