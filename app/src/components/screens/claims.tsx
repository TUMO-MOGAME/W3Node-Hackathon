"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Banknote, Check, CircleX, Clock, Plus, Zap } from "lucide-react";
import type { ScreensCopy } from "@/content/screens";
import { useLocalized } from "@/lib/i18n/client";
import type { EstateSnapshot } from "@/lib/service";
import type { AgentReport, Claim, Role, WalletSession } from "@/lib/types";
import { formatUsdt, formatZar, toBase } from "@/lib/format";
import { useEstate } from "@/lib/hooks/estate";
import { Badge, Button, ButtonLink, Card, Consent, EmptyState, ExplorerLink, Field, inputClass, Notice, PageHeader } from "@/components/ui/primitives";
import { FilePicker } from "@/components/ui/client";
import { ReportCard, Reviewing } from "@/components/agent/report-card";
import { Blocked } from "@/components/shell/blocked";
import { usePay } from "@/components/pay/payment";
import { fmt, useCopy } from "@/components/shell/copy";
import { Gate } from "@/components/shell/gate";
import { categoryIcon } from "./estate";

type Copy = ScreensCopy["claims"];

export function ClaimsScreen({ copy: english }: { copy: Copy }) {
  const copy = useLocalized(english, (t) => t.screens.claims);
  return <Gate>{({ snap, session, role }) => <Claims copy={copy} snap={snap!} session={session} role={role} />}</Gate>;
}

function Claims({ copy, snap, session, role }: { copy: Copy; snap: EstateSnapshot; session: WalletSession; role: Role }) {
  const { common } = useCopy();
  const { intent, setIntent } = useEstate();
  const e = snap.estate;
  const myRules = snap.rules.filter((r) => r.beneficiary === session.address && r.recurringAmount === BigInt(0));
  const open = (r: (typeof myRules)[number]) => e.status === "Unlocked" || (r.startsNow && e.status === "Active");
  const canClaim = role === "beneficiary" && myRules.some(open);
  const ownerName = e.ownerName.split(" ")[0];
  const forOwner = role === "owner" && e.status === "Active" ? snap.claims.filter((c) => c.status === "Open" && c.agentVerdict === "Approved" && snap.rules.find((r) => r.address === c.rule)?.startsNow) : [];
  const [wizard, setWizard] = useState<{ rule?: string; payee?: string; amount?: number } | null>(null);
  const claims = role === "beneficiary" ? snap.claims.filter((c) => c.beneficiary === session.address) : snap.claims;

  useEffect(() => {
    if (!intent || !canClaim) return;
    if (intent.kind === "claim") { setWizard({ rule: intent.rule, payee: intent.payee, amount: intent.amount }); setIntent(null); }
    else if (intent.kind === "upload" && intent.purpose === "claim") { setWizard({}); setIntent(null); }
  }, [intent, canClaim, setIntent]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow={copy.eyebrow} title={copy.title} body={copy.body}
        action={canClaim && !wizard ? <Button onClick={() => setWizard({})}><Plus className="size-5" aria-hidden="true" />{copy.newCta}</Button> : undefined}
      />

      {role === "owner" && (
        <section aria-labelledby="owner-approvals" className="mb-6">
          <h2 id="owner-approvals" className="text-h3">{copy.owner.title}</h2>
          <p className="mb-3 text-small text-ink-2">{copy.owner.body}</p>
          {forOwner.length === 0 ? <p className="text-ink-2">{copy.owner.empty}</p> : (
            <ul className="grid gap-3">{forOwner.map((c) => <OwnerApproval key={c.address} claim={c} snap={snap} copy={copy} />)}</ul>
          )}
        </section>
      )}
      {canClaim && e.status === "Active" && <Notice icon={<Zap className="size-5" aria-hidden="true" />} className="mb-5"><p className="text-body">{fmt(copy.living, { owner: ownerName })}</p></Notice>}
      {role === "beneficiary" && !canClaim && myRules.length > 0 && (
        <Notice tone="warn" icon={<Clock className="size-5" aria-hidden="true" />} title={copy.locked.title} className="mb-5">
          <p>{fmt(copy.locked.body, { status: common.status.estate[e.status].toLowerCase() })}</p>
          <ButtonLink href="/family" small variant="secondary" className="mt-3">{copy.locked.cta}</ButtonLink>
        </Notice>
      )}
      {role === "beneficiary" && myRules.length === 0 && <p className="mb-5 text-ink-2">{copy.noRules}</p>}

      <AnimatePresence mode="wait" initial={false}>
        {wizard && canClaim ? (
          <motion.div key="wizard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            <Wizard copy={copy} snap={snap} session={session} preset={wizard} onClose={() => setWizard(null)} />
          </motion.div>
        ) : (
          <motion.section key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} aria-labelledby="claims-list">
            <h2 id="claims-list" className="mb-3 text-h3">{role === "beneficiary" ? copy.listTitle : copy.listTitleAll}</h2>
            {claims.length === 0
              ? <EmptyState icon={<Banknote className="size-6" aria-hidden="true" />} title={copy.empty} action={canClaim ? <Button onClick={() => setWizard({})}>{copy.newCta}</Button> : undefined} />
              : <ul className="grid gap-3">{claims.map((c) => <ClaimCard key={c.address} claim={c} snap={snap} copy={copy} />)}</ul>}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- A claim and its progress ---------- */

export function ClaimTracker({ claim, need, copy, waitingFor }: { claim: Claim; need: number; copy: Copy; waitingFor?: string }) {
  const t = copy.tracker;
  const got = claim.approvals.filter(Boolean).length;
  const declined = claim.status === "Rejected";
  const steps = [
    { label: t.submitted, done: true },
    { label: declined ? t.declined : t.checked, done: claim.agentVerdict !== "Pending", bad: declined },
    { label: t.approved, done: claim.status === "Paid" || got >= need, note: !declined && claim.status === "Open" ? (waitingFor ?? fmt(t.approvals, { got, need })) : undefined },
    { label: t.paid, done: claim.status === "Paid" },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol aria-label={t.label} className="grid grid-cols-4 gap-1">
      {steps.map((s, i) => (
        <li key={s.label} className="flex flex-col items-center gap-1 text-center" aria-current={i === current && !declined ? "step" : undefined}>
          <div className="flex w-full items-center">
            <span className={clsx("h-0.5 flex-1", i === 0 ? "bg-transparent" : steps[i].done ? "bg-accent" : "bg-line")} aria-hidden="true" />
            <motion.span
              initial={false} animate={{ scale: s.done ? [1, 1.2, 1] : 1 }} transition={{ duration: 0.4 }}
              className={clsx("grid size-7 shrink-0 place-items-center rounded-full border-2", s.bad ? "border-danger bg-danger text-surface" : s.done ? "border-accent bg-accent text-accent-ink" : i === current && !declined ? "border-brass bg-brass-soft" : "border-line-strong/50 bg-surface")}
              aria-hidden="true"
            >
              {s.bad ? <CircleX className="size-4" /> : s.done ? <Check className="size-4" /> : i === current && !declined ? <span className="size-2 animate-pulse-soft rounded-full bg-brass" /> : null}
            </motion.span>
            <span className={clsx("h-0.5 flex-1", i === steps.length - 1 ? "bg-transparent" : steps[i + 1].done ? "bg-accent" : "bg-line")} aria-hidden="true" />
          </div>
          <span className={clsx("text-[0.7rem] font-semibold leading-tight", s.bad ? "text-danger" : s.done ? "text-ink" : "text-ink-2")}>{s.label}<span className="sr-only">{s.done ? " ✓" : ""}</span></span>
          {s.note && <span className="text-[0.7rem] leading-tight text-brass">{s.note}</span>}
        </li>
      ))}
    </ol>
  );
}

function ClaimCard({ claim, snap, copy }: { claim: Claim; snap: EstateSnapshot; copy: Copy }) {
  const { common } = useCopy();
  const { fx } = useEstate();
  const rate = fx?.usdtZar ?? null;
  const rule = snap.rules.find((r) => r.address === claim.rule);
  const payee = snap.payees.find((p) => p.wallet === claim.payee)?.name ?? "";
  const who = snap.beneficiaries.find((b) => b.wallet === claim.beneficiary)?.label ?? "";
  const Icon = rule ? categoryIcon[rule.category] : Banknote;
  const tone = claim.status === "Paid" ? "ok" : claim.status === "Rejected" ? "danger" : "warn";
  return (
    <motion.li layout className="rounded-lg border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Icon className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold tabular-nums">{formatUsdt(claim.amount)}{rate ? <span className="block text-small font-normal text-ink-2">≈ {formatZar(claim.amount, rate)}</span> : null}</p>
          <p className="text-small text-ink-2">{fmt(copy.card.to, { payee })} · {fmt(copy.card.forWho, { name: who })}</p>
        </div>
        <Badge tone={tone}>{common.status.claim[claim.status]}</Badge>
      </div>
      <div className="mt-4"><ClaimTracker claim={claim} need={snap.estate.claimThreshold} copy={copy} waitingFor={snap.estate.status === "Active" && rule?.startsNow ? fmt(copy.card.waitingOwner, { owner: snap.estate.ownerName.split(" ")[0] }) : undefined} /></div>
      {claim.status === "Paid" && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-md border border-ok/30 bg-ok-soft p-3">
          <p className="flex items-center gap-2 font-semibold text-ok"><Check className="size-5" aria-hidden="true" />{fmt(copy.card.paidOn, { payee })}</p>
          {rate && <p className="mt-1 flex flex-wrap items-center gap-2 text-small">{fmt(copy.card.settlement, { zar: formatZar(claim.amount, rate), payee })}<Badge tone="warn">{copy.card.simulated}</Badge></p>}
          <p className="text-[0.75rem] text-ink-2">{copy.card.settlementNote}</p>
          {claim.txSignature && <ExplorerLink signature={claim.txSignature} label={copy.card.receipt} srLabel={copy.card.receiptSr} />}
        </motion.div>
      )}
      {claim.agentReport && claim.status !== "Paid" && (
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-small font-semibold text-accent">{copy.card.report}</summary>
          <ReportCard report={claim.agentReport} compact />
        </details>
      )}
    </motion.li>
  );
}

/* ---------- New claim wizard ---------- */

function Wizard({ copy, snap, session, preset, onClose }: { copy: Copy; snap: EstateSnapshot; session: WalletSession; preset: { rule?: string; payee?: string; amount?: number }; onClose: () => void }) {
  const { common } = useCopy();
  const { fx, run, busy } = useEstate();
  const w = copy.wizard;
  const rate = fx?.usdtZar ?? null;
  const live = snap.estate.status;
  const usable = (r: { startsNow: boolean }) => live === "Unlocked" || (r.startsNow && live === "Active");
  const rules = snap.rules.filter((r) => r.beneficiary === session.address && r.recurringAmount === BigInt(0)).sort((a, b) => Number(usable(b)) - Number(usable(a)));
  const [ruleAddr, setRuleAddr] = useState(preset.rule && rules.some((r) => r.address === preset.rule && usable(r)) ? preset.rule : rules.filter(usable).length === 1 ? rules.filter(usable)[0].address : "");
  const rule = rules.find((r) => r.address === ruleAddr);
  const payees = rule ? snap.payees.filter((p) => p.kind === rule.allowedPayeeKind) : [];
  const [payee, setPayee] = useState(preset.payee ?? "");
  const [amount, setAmount] = useState(preset.amount ? String(preset.amount) : "");
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState(preset.rule && preset.payee ? 2 : preset.rule ? 1 : 0);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ code: string; message: string } | null>(null);
  const [result, setResult] = useState<{ report: AgentReport; claim: string } | null>(null);

  const n = Number(amount.replace(/[\s,]/g, ""));
  const validAmount = Number.isFinite(n) && n > 0;
  const left = rule ? rule.lifetimeCap - rule.spentTotal : BigInt(0);
  const payeeName = snap.payees.find((p) => p.wallet === payee)?.name ?? "";

  useEffect(() => { if (payees.length === 1 && !payee) setPayee(payees[0].wallet); }, [payees, payee]);

  const next = () => {
    if (step === 0 && !rule) return;
    if (step === 1 && !payee) return;
    if (step === 2 && !validAmount) { setError(w.amount.error); return; }
    setError(null);
    setStep((s) => s + 1);
  };

  const submit = async () => {
    if (!rule) return;
    if (!file) { setError(w.evidence.needFile); return; }
    if (!consent) { setError(common.consentRequired); return; }
    setError(null); setBlocked(null);
    const res = await run("claim", (s, est) => s.submitClaim(est, { rule: rule.address, payee, amountUsdt: n, evidence: file }), undefined, true);
    if (res.ok) setResult({ report: res.value.report, claim: res.value.claim });
    else setBlocked({ code: res.code, message: res.message });
  };

  if (busy === "claim") return <Reviewing />;

  if (result) {
    const claim = snap.claims.find((c) => c.address === result.claim);
    const ok = result.report.verdict === "approve";
    return (
      <Card>
        <h2 className="text-h3" role="status">{ok ? copy.result.submitted : copy.result.declined}</h2>
        <p className="mt-1 text-ink-2">{!ok ? copy.result.declinedBody : live === "Active" ? fmt(copy.result.submittedBodyOwner, { owner: snap.estate.ownerName.split(" ")[0] }) : copy.result.submittedBody}</p>
        {claim && <div className="mt-4"><ClaimTracker claim={claim} need={snap.estate.claimThreshold} copy={copy} /></div>}
        <div className="mt-4"><ReportCard report={result.report} /></div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onClose}>{copy.listTitle}</Button>
          <Button variant="secondary" onClick={() => { setResult(null); setFile(null); setConsent(false); setStep(0); setAmount(""); }}>{copy.result.another}</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-h3">{w.title}</h2>
        <Button variant="ghost" small onClick={onClose}>{w.cancel}</Button>
      </div>
      <ol className="mt-3 flex gap-1.5" aria-label={fmt(w.stepLabel, { n: step + 1, name: w.steps[step] })}>
        {w.steps.map((s, i) => (
          <li key={s} className="flex flex-1 flex-col gap-1" aria-current={i === step ? "step" : undefined}>
            <span className={clsx("h-1.5 rounded-full transition-colors", i <= step ? "bg-accent" : "bg-line")} />
            <span className={clsx("text-[0.7rem] font-semibold", i === step ? "text-ink" : "text-ink-2")}>{s}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5 min-h-48">
        {step === 0 && (
          <fieldset>
            <legend className="mb-2 font-semibold">{w.rule.legend}</legend>
            <div className="grid gap-2">
              {rules.map((r) => {
                const Icon = categoryIcon[r.category];
                return (
                  <label key={r.address} className={clsx("flex min-h-16 cursor-pointer items-center gap-3 rounded-md border p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]", ruleAddr === r.address ? "border-accent bg-accent-soft" : "border-line-strong/60", !usable(r) && "cursor-not-allowed opacity-60")}>
                    <input type="radio" name="claim-rule" className="sr-only" disabled={!usable(r)} checked={ruleAddr === r.address} onChange={() => { setRuleAddr(r.address); setPayee(""); }} />
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-accent"><Icon className="size-5" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-semibold">{common.status.category[r.category]}<Badge tone={r.startsNow ? "accent" : "neutral"}>{r.startsNow ? w.rule.now : w.rule.later}</Badge></span>
                      {!usable(r) && <span className="block text-small font-medium text-brass">{w.rule.notYet}</span>}
                      <span className="block text-small text-ink-2">{fmt(w.rule.left, { amount: formatUsdt(r.lifetimeCap - r.spentTotal, { decimals: 0 }) })} · {fmt(w.rule.perClaim, { amount: formatUsdt(r.maxPerClaim, { decimals: 0 }) })}</span>
                    </span>
                    {ruleAddr === r.address && <Check className="size-5 shrink-0 text-accent" aria-hidden="true" />}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {step === 1 && (
          <fieldset>
            <legend className="mb-1 font-semibold">{w.payee.legend}</legend>
            <p className="mb-2 text-small text-ink-2">{w.payee.hint}</p>
            {payees.length === 0 ? <p className="text-ink-2">{w.payee.none}</p> : (
              <div className="grid gap-2">
                {payees.map((p) => (
                  <label key={p.wallet} className={clsx("flex min-h-14 cursor-pointer items-center gap-3 rounded-md border p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]", payee === p.wallet ? "border-accent bg-accent-soft" : "border-line-strong/60")}>
                    <input type="radio" name="claim-payee" className="sr-only" checked={payee === p.wallet} onChange={() => setPayee(p.wallet)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{p.name}</span>
                      <span className="block text-small text-ink-2">{common.status.payeeKind[p.kind]}</span>
                    </span>
                    {payee === p.wallet && <Check className="size-5 shrink-0 text-accent" aria-hidden="true" />}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )}

        {step === 2 && rule && (
          <div className="flex flex-col gap-3">
            <Field label={w.amount.label} htmlFor="claim-amount" error={error} hint={fmt(w.amount.hint, { zar: validAmount && rate ? formatZar(toBase(n), rate) : "R 0", max: formatUsdt(rule.maxPerClaim, { decimals: 0 }) })}>
              <div className="relative">
                <input
                  id="claim-amount" inputMode="decimal" autoComplete="off" placeholder="0" autoFocus value={amount}
                  onChange={(ev) => { setAmount(ev.target.value.replace(/[^\d.,\s]/g, "")); setError(null); setBlocked(null); }}
                  aria-invalid={!!error} aria-describedby={error ? "claim-amount-error" : "claim-amount-hint"}
                  className={`${inputClass} min-h-16 pr-20 font-display text-h2 tabular-nums`}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-semibold text-ink-2">USD₮</span>
              </div>
            </Field>
            {validAmount && toBase(n) > rule.maxPerClaim && <Notice tone="warn"><p role="status">{fmt(w.amount.over, { max: formatUsdt(rule.maxPerClaim, { decimals: 0 }) })}</p></Notice>}
            {validAmount && toBase(n) <= rule.maxPerClaim && toBase(n) > left && <Notice tone="warn"><p role="status">{fmt(w.amount.overLeft, { left: formatUsdt(left, { decimals: 0 }) })}</p></Notice>}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <p className="rounded-md bg-surface-2 px-3.5 py-2.5 font-semibold">{fmt(w.summary, { amount: formatUsdt(toBase(n || 0)), payee: payeeName })}</p>
            <FilePicker id="claim-evidence" label={w.evidence.label} hint={w.evidence.hint} file={file} onFile={(f) => { setFile(f); setError(null); }} samples={w.evidence.samples} copy={common.file} />
            <Consent id="claim-consent" checked={consent} onChange={(v) => { setConsent(v); setError(null); }} copy={common.consent} />
            {error && <p role="alert" className="text-small font-medium text-danger">{error}</p>}
            {blocked && (
              <Blocked code={blocked.code} message={blocked.message}>
                <Button small variant="secondary" onClick={() => { setBlocked(null); setStep(2); }}>{copy.result.tryAgain}</Button>
              </Blocked>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 flex gap-3">
        {step > 0 && <Button variant="secondary" onClick={() => { setError(null); setStep((s) => s - 1); }}><ArrowLeft className="size-4" aria-hidden="true" />{w.back}</Button>}
        {step < 3
          ? <Button className="flex-1" onClick={next} disabled={(step === 0 && !rule) || (step === 1 && !payee)}>{w.next}<ArrowRight className="size-5" aria-hidden="true" /></Button>
          : <Button className="flex-1" onClick={submit}>{w.submit}</Button>}
      </div>
    </Card>
  );
}

/* ---------- Owner: approve a living-plan claim, then the vault pays the institution ---------- */

function OwnerApproval({ claim, snap, copy }: { claim: Claim; snap: EstateSnapshot; copy: Copy }) {
  const { common } = useCopy();
  const { fx, busy } = useEstate();
  const { pay } = usePay();
  const rate = fx?.usdtZar ?? null;
  const rule = snap.rules.find((r) => r.address === claim.rule);
  const payee = snap.payees.find((p) => p.wallet === claim.payee)?.name ?? "";
  const who = snap.beneficiaries.find((b) => b.wallet === claim.beneficiary)?.label ?? "";
  return (
    <motion.li layout className="rounded-xl border border-accent/40 bg-surface p-4 shadow-card">
      <p className="text-h3 font-display tabular-nums">{formatUsdt(claim.amount)}{rate ? <span className="ml-2 font-sans text-small text-ink-2">≈ {formatZar(claim.amount, rate)}</span> : null}</p>
      <p className="font-semibold">{fmt(copy.card.to, { payee })}</p>
      <p className="text-small text-ink-2">{fmt(copy.owner.forWho, { name: who, category: rule ? common.status.category[rule.category].toLowerCase() : "" })}</p>
      {claim.agentReport && <div className="mt-3"><ReportCard report={claim.agentReport} compact /></div>}
      <Button
        className="mt-3" block disabled={!!busy}
        onClick={() => void pay({
          kind: "claim-payout", source: "vault", to: claim.payee, toLabel: payee, amount: claim.amount,
          execute: async (svc, est) => { await svc.ownerApproveClaim(est, claim.address); return svc.executeClaim(est, claim.address); },
          successText: fmt(copy.owner.done, { payee }),
        })}
      >
        <Check className="size-5" aria-hidden="true" />{copy.owner.approve}
      </Button>
    </motion.li>
  );
}
