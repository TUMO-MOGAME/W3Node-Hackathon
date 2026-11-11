"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, Check, HandHeart, TriangleAlert } from "lucide-react";
import type { ScreensCopy } from "@/content/screens";
import { useLocalized } from "@/lib/i18n/client";
import type { EstateSnapshot } from "@/lib/service";
import type { AgentReport, Hardship, Role, WalletSession } from "@/lib/types";
import { useEstate } from "@/lib/hooks/estate";
import { Badge, Button, ButtonLink, Card, Consent, Money, Notice, PageHeader } from "@/components/ui/primitives";
import { FilePicker, Quorum } from "@/components/ui/client";
import { ReportCard, Reviewing } from "@/components/agent/report-card";
import { Blocked } from "@/components/shell/blocked";
import { fmt, useCopy } from "@/components/shell/copy";
import { Gate } from "@/components/shell/gate";
import { formatUsdt } from "@/lib/format";

type Copy = ScreensCopy["hardship"];

export function HardshipScreen({ copy: english }: { copy: Copy }) {
  const copy = useLocalized(english, (t) => t.screens.hardship);
  return <Gate>{({ snap, session, role }) => <HardshipView copy={copy} snap={snap!} session={session} role={role} />}</Gate>;
}

function HardshipView({ copy, snap, session, role }: { copy: Copy; snap: EstateSnapshot; session: WalletSession; role: Role }) {
  const { common } = useCopy();
  const { fx, run, busy } = useEstate();
  const rate = fx?.usdtZar ?? null;
  const e = snap.estate;
  const car = snap.assets[0];
  const isFamily = snap.beneficiaries.some((b) => b.wallet === session.address);
  const list = isFamily ? snap.hardships.filter((h) => h.beneficiary === session.address) : snap.hardships;
  const open = list.find((h) => h.status === "Open" || h.status === "Approved");
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ code: string; message: string } | null>(null);
  const [rejected, setRejected] = useState<AgentReport | null>(null);
  const nameOf = (h: Hardship) => snap.beneficiaries.find((b) => b.wallet === h.beneficiary)?.label ?? "";

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!car) return;
    if (!file) { setError(copy.needFile); return; }
    if (!consent) { setError(common.consentRequired); return; }
    setError(null); setBlocked(null);
    const res = await run("hardship", (s, est) => s.submitHardship(est, { asset: car.address, evidence: file }), undefined, true);
    if (!res.ok) setBlocked({ code: res.code, message: res.message });
    else if (res.value.report.verdict !== "approve") setRejected(res.value.report);
  };

  const cannot = !car ? copy.noCar : car.status === "Sold" ? copy.sold : e.status !== "Unlocked" ? copy.locked : null;
  const showForm = isFamily && !cannot && !open && !rejected;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} body={copy.body} />

      {car && (
        <Card className="mb-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-small text-ink-2">{copy.numbers.floor}</p>
              <Money base={car.floorPrice} rate={rate} size="lg" />
            </div>
            <div>
              <p className="text-small text-ink-2">{copy.numbers.hardshipFloor}</p>
              <Money base={car.hardshipFloor} rate={rate} size="lg" />
            </div>
          </div>
          <p className="mt-3 border-t border-line/70 pt-3 text-small text-ink-2">{copy.numbers.note}</p>
        </Card>
      )}

      {cannot && <Notice tone="warn" className="mb-5"><p className="text-body">{cannot}</p></Notice>}
      {!isFamily && role !== "verifier" && !cannot && <p className="mb-5 text-small text-ink-2">{copy.onlyFamily}</p>}

      {list.length > 0 && (
        <section aria-labelledby="hardship-status" className="mb-5">
          <h2 id="hardship-status" className="mb-3 text-h3">{isFamily ? copy.statusTitle : copy.statusTitleAll}</h2>
          <ul className="grid gap-3">
            {list.map((h) => {
              const got = h.approvals.filter(Boolean).length;
              return (
                <li key={h.address} className="rounded-lg border border-line bg-surface p-4 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{fmt(copy.from, { name: nameOf(h) })}</p>
                    <Badge tone={h.status === "Approved" ? "ok" : h.status === "Rejected" ? "danger" : "warn"}>{common.status.hardship[h.status]}</Badge>
                  </div>
                  {h.status === "Open" && (
                    <div className="mt-3"><Quorum approvals={h.approvals} needed={e.hardshipThreshold} names={e.verifierNames} label={fmt(copy.approvals, { got, need: e.hardshipThreshold })} /></div>
                  )}
                  {h.status === "Approved" && car && (
                    <p className="mt-3 flex items-start gap-2 rounded-md bg-ok-soft p-3 font-medium text-ok"><Check className="mt-0.5 size-5 shrink-0" aria-hidden="true" />{fmt(copy.approved, { floor: formatUsdt(car.hardshipFloor, { decimals: 0 }), name: nameOf(h).split(" ")[0] })}</p>
                  )}
                  {h.status === "Rejected" && <p className="mt-2 text-small text-ink-2">{copy.rejected}</p>}
                  {h.agentReport && <div className="mt-3"><ReportCard report={h.agentReport} compact /></div>}
                </li>
              );
            })}
          </ul>
          <ButtonLink href="/car" variant="secondary" small className="mt-3">{copy.viewCar}<ArrowRight className="size-4" aria-hidden="true" /></ButtonLink>
        </section>
      )}
      {list.length === 0 && !isFamily && <p className="text-ink-2">{copy.empty}</p>}

      {busy === "hardship" && <Reviewing />}

      {rejected && busy !== "hardship" && (
        <Card>
          <Notice tone="danger" icon={<TriangleAlert className="size-5" aria-hidden="true" />}><p role="alert" className="text-body font-medium">{copy.rejected}</p></Notice>
          <Button variant="secondary" className="mt-3" onClick={() => { setRejected(null); setFile(null); }}>{copy.again}</Button>
        </Card>
      )}

      {showForm && busy !== "hardship" && (
        <Card>
          <h2 className="flex items-center gap-2 text-h3"><HandHeart className="size-5 text-accent" aria-hidden="true" />{copy.needTitle}</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-2 marker:text-brass">
            {copy.need.map((n) => <li key={n}>{n}</li>)}
          </ul>
          <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-4">
            <FilePicker id="hardship-file" label={copy.file} hint={copy.fileHint} file={file} onFile={(f) => { setFile(f); setError(null); }} samples={copy.samples} copy={common.file} />
            <Consent id="hardship-consent" checked={consent} onChange={(v) => { setConsent(v); setError(null); }} copy={common.consent} />
            {error && <p role="alert" className="text-small font-medium text-danger">{error}</p>}
            {blocked && <Blocked code={blocked.code} message={blocked.message} />}
            <Button type="submit">{copy.submit}</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
