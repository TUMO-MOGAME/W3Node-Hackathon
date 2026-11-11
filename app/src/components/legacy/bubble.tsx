"use client";
import type { ReactNode } from "react";
import clsx from "clsx";
import { BookHeart } from "@/components/ui/icons";
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
        : <span className="mt-6 grid size-7 shrink-0 place-items-center rounded-full border border-ink bg-surface font-display text-small text-ink" aria-hidden="true">{called.slice(0, 1)}</span>}
      <div className="min-w-0 max-w-[88%]">
        <p className="mb-1 flex flex-wrap items-center gap-2 text-small font-semibold">
          <span className="text-ink">{heirloom ? copy.child.heirloom : called}</span>
          {source === "book" && <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 text-[0.75rem] font-medium text-ink-2"><BookHeart className="size-3" aria-hidden="true" />{copy.child.fromBook}</span>}
        </p>
        <p className={clsx("whitespace-pre-line rounded-[1.25rem] rounded-tl-md px-4 py-2.5", heirloom ? "border-2 border-ink bg-surface" : "border border-dashed border-line-strong bg-surface")}>{text}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </li>
  );
}
