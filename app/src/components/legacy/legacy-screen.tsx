"use client";
import { CloudOff } from "lucide-react";
import type { LegacyCopy, LegacySafetyCopy } from "@/content/legacy";
import type { EstateSnapshot } from "@/lib/service";
import { Button, EmptyState, LoadingCards, PageHeader } from "@/components/ui/primitives";
import { Gate } from "@/components/shell/gate";
import { fmt } from "@/components/shell/copy";
import { pronouns } from "@/lib/legacy/prompt";
import { OwnerStudio } from "./owner-studio";
import { ChildTalk } from "./child-talk";
import { useLegacyStatus } from "./use-legacy";

/** /legacy: the owner records their voice and Legacy Book; a child (after unlock, by choice) talks with it. */
export function LegacyScreen({ copy, safety }: { copy: LegacyCopy; safety: LegacySafetyCopy }) {
  return <Gate roles={["owner", "beneficiary"]}>{({ snap, role }) => <Inner copy={copy} safety={safety} role={role} snap={snap!} />}</Gate>;
}

function Inner({ copy, safety, role, snap }: { copy: LegacyCopy; safety: LegacySafetyCopy; role: string; snap: EstateSnapshot }) {
  const { status, error, reload } = useLegacyStatus();
  const owner = role === "owner";
  const called = status?.book?.calledBy ?? "Dad";
  const p = pronouns(status?.book?.pronoun ?? "he");
  const vars = { called, calledLower: called.toLowerCase(), pronoun: p.subject, possessive: p.possessive };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow={copy.eyebrow} title={owner ? copy.owner.title : fmt(copy.child.title, vars)} body={owner ? copy.owner.body : fmt(copy.child.body, vars)} />
      {error && !status ? (
        <EmptyState icon={<CloudOff className="size-6" aria-hidden="true" />} title={copy.child.error} body={error} action={<Button onClick={() => void reload()}>{copy.child.retry}</Button>} />
      ) : !status ? (
        <LoadingCards label={copy.eyebrow} />
      ) : owner ? (
        <OwnerStudio copy={copy} status={status} snap={snap} reload={reload} />
      ) : (
        <ChildTalk copy={copy} safety={safety} status={status} snap={snap} reload={reload} />
      )}
    </div>
  );
}
