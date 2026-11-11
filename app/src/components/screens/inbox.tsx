"use client";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, Check, FileHeart, HandHeart, Inbox as InboxIcon, Undo2 } from "lucide-react";
import type { ScreensCopy } from "@/content/screens";
import { useLocalized } from "@/lib/i18n/client";
import type { EstateSnapshot } from "@/lib/service";
import type { AgentReport, WalletSession } from "@/lib/types";
import { formatUsdt, formatZar } from "@/lib/format";
import { useEstate } from "@/lib/hooks/estate";
import { Badge, Button, EmptyState, PageHeader } from "@/components/ui/primitives";
import { Quorum } from "@/components/ui/client";
import { ReportCard } from "@/components/agent/report-card";
import { fmt, useCopy } from "@/components/shell/copy";
import { Gate } from "@/components/shell/gate";
import { usePay } from "@/components/pay/payment";

type Copy = ScreensCopy["inbox"];

interface Item {
  key: string;
  kind: "death" | "claim" | "hardship";
  title: string;
  body: string;
  amountZar?: string;
  report?: AgentReport;
  approvals: boolean[];
  need: number;
  mine: boolean; // this person has already approved
  approveLabel: string;
  act: () => Promise<void>;
}

export function InboxScreen({ copy: english }: { copy: Copy }) {
  const copy = useLocalized(english, (t) => t.screens.inbox);
  return <Gate roles={["verifier"]}>{({ snap, session }) => <Inbox copy={copy} snap={snap!} session={session} />}</Gate>;
}

function Inbox({ copy, snap, session }: { copy: Copy; snap: EstateSnapshot; session: WalletSession }) {
  const { common } = useCopy();
  const { fx, run, busy } = useEstate();
  const [declined, setDeclined] = useState<string[]>([]);
  const { pay } = usePay();
  const e = snap.estate;
  const rate = fx?.usdtZar ?? null;
  const me = e.verifiers.indexOf(session.address);
  const label = (wallet: string) => snap.beneficiaries.find((b) => b.wallet === wallet)?.label ?? "";
  const car = snap.assets[0];

  const items: Item[] = [];
  const d = e.death;
  if (e.status === "Active" && d.certHash && d.verdict === "Approved") {
    items.push({
      key: "death", kind: "death",
      title: fmt(copy.death.title, { name: e.ownerName }),
      body: fmt(copy.death.body, { by: d.submittedBy ? label(d.submittedBy) : "" }),
      report: (d as { agentReport?: AgentReport }).agentReport,
      approvals: d.attestations, need: e.deathThreshold, mine: !!d.attestations[me], approveLabel: copy.death.approve,
      act: async () => { await run("death", (s, est) => s.attestDeath(est), copy.death.done); },
    });
  }
  for (const c of e.status === "Unlocked" ? snap.claims.filter((x) => x.status === "Open" && x.agentVerdict === "Approved") : []) {
    const rule = snap.rules.find((r) => r.address === c.rule);
    const payee = snap.payees.find((p) => p.wallet === c.payee)?.name ?? "";
    const got = c.approvals.filter(Boolean).length;
    items.push({
      key: c.address, kind: "claim",
      title: fmt(copy.claim.title, { amount: formatUsdt(c.amount), payee }),
      body: fmt(copy.claim.body, {
        name: label(c.beneficiary), category: rule ? common.status.category[rule.category].toLowerCase() : "",
        left: rule ? formatUsdt(rule.lifetimeCap - rule.spentTotal - c.amount, { decimals: 0 }) : "",
      }),
      amountZar: rate ? formatZar(c.amount, rate) : undefined,
      report: c.agentReport, approvals: c.approvals, need: e.claimThreshold, mine: !!c.approvals[me], approveLabel: copy.claim.approve,
      act: async () => {
        // Approve, and if that completes the quorum, release the payment in the same breath.
        if (got + 1 >= e.claimThreshold) {
          await pay({
            kind: "claim-payout", source: "vault", to: c.payee, toLabel: payee, amount: c.amount,
            execute: async (s, est) => { await s.approveClaim(est, c.address); return s.executeClaim(est, c.address); },
            successText: fmt(copy.claim.done, { payee }),
          });
        } else {
          await run(c.address, (s, est) => s.approveClaim(est, c.address), copy.hardship.done);
        }
      },
    });
  }
  for (const h of snap.hardships.filter((x) => x.status === "Open" && x.agentVerdict === "Approved")) {
    items.push({
      key: h.address, kind: "hardship",
      title: fmt(copy.hardship.title, { name: label(h.beneficiary) }),
      body: car ? fmt(copy.hardship.body, { floor: formatUsdt(car.hardshipFloor, { decimals: 0 }), min: formatUsdt(car.floorPrice, { decimals: 0 }), name: label(h.beneficiary).split(" ")[0] }) : "",
      report: h.agentReport, approvals: h.approvals, need: e.hardshipThreshold, mine: !!h.approvals[me], approveLabel: copy.hardship.approve,
      act: async () => { await run(h.address, (s, est) => s.approveHardship(est, h.address), copy.hardship.done); },
    });
  }

  const todo = items.filter((i) => !i.mine);
  const waiting = items.filter((i) => i.mine);
  const handled: { key: string; text: string; tag: string }[] = [
    ...(e.status !== "Active" && d.attestations[me] ? [{ key: "death", text: fmt(copy.death.title, { name: e.ownerName }), tag: copy.confirmed }] : []),
    ...snap.claims.filter((c) => c.status === "Paid" && c.approvals[me]).map((c) => ({ key: c.address, text: fmt(copy.claim.title, { amount: formatUsdt(c.amount, { decimals: 0 }), payee: snap.payees.find((p) => p.wallet === c.payee)?.name ?? "" }), tag: copy.paid })),
  ];
  const icons: Record<Item["kind"], ReactNode> = {
    death: <FileHeart className="size-5" aria-hidden="true" />, claim: <Banknote className="size-5" aria-hidden="true" />, hardship: <HandHeart className="size-5" aria-hidden="true" />,
  };

  const card = (it: Item) => {
    const got = it.approvals.filter(Boolean).length;
    const isDeclined = declined.includes(it.key);
    return (
      <motion.li key={it.key} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brass-soft text-brass">{icons[it.kind]}</span>
          <div className="min-w-0 flex-1">
            <Badge tone="warn">{copy.kinds[it.kind]}</Badge>
            <h2 className="mt-1.5 text-h3">{it.title}</h2>
            {it.amountZar && <p className="text-small text-ink-2 tabular-nums">≈ {it.amountZar}</p>}
            <p className="mt-1 text-ink-2">{it.body}</p>
          </div>
        </div>
        {it.report && <div className="mt-4"><ReportCard report={it.report} /></div>}
        <div className="mt-4"><Quorum approvals={it.approvals} needed={it.need} names={e.verifierNames} label={fmt(copy.quorum, { got, need: it.need })} /></div>
        {it.mine ? (
          <p className="mt-3 flex items-center gap-2 text-small font-medium text-ok"><Check className="size-4" aria-hidden="true" />{copy.already}</p>
        ) : isDeclined ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-2 p-3">
            <p className="text-small" role="status">{copy.declined}</p>
            <Button variant="ghost" small onClick={() => setDeclined((x) => x.filter((k) => k !== it.key))}><Undo2 className="size-4" aria-hidden="true" />{copy.undo}</Button>
          </div>
        ) : (
          <div className="mt-4 flex gap-3">
            <Button variant="secondary" className="flex-1" disabled={!!busy} onClick={() => setDeclined((x) => [...x, it.key])}>{copy.decline}</Button>
            <Button className="flex-[2]" loading={busy === it.key || (it.kind === "death" && busy === "death")} disabled={!!busy} onClick={() => void it.act()}>
              <Check className="size-5" aria-hidden="true" />{it.approveLabel}
            </Button>
          </div>
        )}
      </motion.li>
    );
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} body={copy.body} />
      {todo.length === 0 && waiting.length === 0
        ? <EmptyState icon={<InboxIcon className="size-6" aria-hidden="true" />} title={copy.empty.title} body={copy.empty.body} />
        : <ul className="grid gap-4"><AnimatePresence initial={false}>{[...todo, ...waiting].map(card)}</AnimatePresence></ul>}

      <section aria-labelledby="handled" className="mt-8">
        <h2 id="handled" className="mb-2 font-sans text-small font-semibold uppercase tracking-[0.12em] text-ink-2">{copy.handled}</h2>
        {handled.length === 0 ? <p className="text-small text-ink-2">{copy.handledEmpty}</p> : (
          <ul>
            {handled.map((h) => (
              <li key={h.key} className="flex items-center justify-between gap-3 border-b border-line/70 py-2.5 text-small last:border-0">
                <span className="min-w-0 truncate">{h.text}</span>
                <Badge tone="ok"><Check className="size-3.5" aria-hidden="true" />{h.tag}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
