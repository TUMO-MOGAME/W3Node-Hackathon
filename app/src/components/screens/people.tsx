"use client";
import { useState, type FormEvent } from "react";
import { Bot, Building2, Plus, ShieldCheck, UsersRound } from "@/components/ui/icons";
import type { ScreensCopy } from "@/content/screens";
import { useLocalized } from "@/lib/i18n/client";
import type { EstateSnapshot } from "@/lib/service";
import type { PayeeKind, Role, WalletSession } from "@/lib/types";
import { shortAddress } from "@/lib/format";
import { useEstate } from "@/lib/hooks/estate";
import { Badge, Button, Card, Field, inputClass, PageHeader } from "@/components/ui/primitives";
import { Avatar } from "@/components/shell/app-shell";
import { fmt, useCopy } from "@/components/shell/copy";
import { Gate } from "@/components/shell/gate";

type Copy = ScreensCopy["people"];
const KINDS: PayeeKind[] = ["University", "School", "Landlord", "Other"];

export function PeopleScreen({ copy: english }: { copy: Copy }) {
  const copy = useLocalized(english, (t) => t.screens.people);
  return <Gate>{({ snap, session, role }) => <People copy={copy} snap={snap!} session={session} role={role} />}</Gate>;
}

function People({ copy, snap, session, role }: { copy: Copy; snap: EstateSnapshot; session: WalletSession; role: Role }) {
  const { common } = useCopy();
  const { run, busy } = useEstate();
  const e = snap.estate;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PayeeKind>("University");
  const [wallet, setWallet] = useState("");
  const [error, setError] = useState<string | null>(null);
  const thresholds = [e.deathThreshold, e.claimThreshold, e.hardshipThreshold];
  const you = (addr: string) => addr === session.address && <Badge tone="accent">{copy.you}</Badge>;

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!name.trim() || wallet.trim().length < 32) { setError(copy.payees.error); return; }
    setError(null);
    const res = await run("payee", (s, est) => s.addPayee(est, { name: name.trim(), kind, wallet: wallet.trim() }), copy.payees.added);
    if (res.ok) { setAdding(false); setName(""); setWallet(""); }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} body={copy.body} />
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="md:col-span-2">
          <h2 className="flex items-center gap-2 text-h3"><ShieldCheck className="size-5 text-accent" aria-hidden="true" />{copy.trusted.title}</h2>
          <p className="mt-1 text-ink-2">{copy.trusted.body}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {e.verifierNames.map((n, i) => (
              <li key={e.verifiers[i]} className="flex items-center gap-3 rounded-md border border-line bg-surface-2/50 p-3">
                <Avatar name={n} role="verifier" className="size-11" />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">{n}{you(e.verifiers[i])}</p>
                  <p className="text-small text-ink-2">{copy.trusted.slots[i]}</p>
                  <p className="font-mono text-[0.75rem] text-ink-2">{shortAddress(e.verifiers[i])}</p>
                </div>
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {copy.trusted.thresholds.map((t, i) => (
              <div key={t.label} className="flex flex-col-reverse rounded-md bg-accent-soft p-2.5">
                <dt className="text-[0.75rem] leading-tight text-ink-2">{t.label}</dt>
                <dd className="font-display text-h3 text-accent">{fmt(t.value, { n: thresholds[i] })}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-h3"><UsersRound className="size-5 text-accent" aria-hidden="true" />{copy.family.title}</h2>
          <p className="mt-1 text-ink-2">{copy.family.body}</p>
          <ul className="mt-3 flex flex-col">
            {snap.beneficiaries.map((b) => {
              const count = snap.rules.filter((r) => r.beneficiary === b.wallet).length;
              return (
                <li key={b.address} className="flex items-center gap-3 border-b border-line/70 py-2.5 last:border-0">
                  <Avatar name={b.label} role="beneficiary" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">{b.label}{you(b.wallet)}</p>
                    <p className="font-mono text-[0.75rem] text-ink-2">{shortAddress(b.wallet)}</p>
                  </div>
                  <span className="shrink-0 text-small text-ink-2">{count === 1 ? copy.family.oneRule : fmt(copy.family.rules, { n: count })}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-h3"><Building2 className="size-5 text-accent" aria-hidden="true" />{copy.payees.title}</h2>
          <p className="mt-1 text-ink-2">{copy.payees.body}</p>
          {snap.payees.length === 0 ? <p className="mt-3 text-ink-2">{copy.payees.empty}</p> : (
            <ul className="mt-3 flex flex-col">
              {snap.payees.map((p) => (
                <li key={p.address} className="flex items-center justify-between gap-3 border-b border-line/70 py-2.5 last:border-0">
                  <div className="min-w-0">
                    <p className="font-semibold">{p.name}</p>
                    <p className="font-mono text-[0.75rem] text-ink-2">{shortAddress(p.wallet)}</p>
                  </div>
                  <Badge>{common.status.payeeKind[p.kind]}</Badge>
                </li>
              ))}
            </ul>
          )}
          {role === "owner" && e.status === "Active" && !adding && (
            <Button variant="secondary" small className="mt-3" onClick={() => setAdding(true)}><Plus className="size-4" aria-hidden="true" />{copy.payees.add}</Button>
          )}
          {adding && (
            <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-3 rounded-md border border-line bg-surface-2/50 p-3">
              <Field label={copy.payees.name} htmlFor="payee-name">
                <input id="payee-name" value={name} maxLength={64} onChange={(ev) => setName(ev.target.value)} className={inputClass} autoComplete="organization" />
              </Field>
              <Field label={copy.payees.kind} htmlFor="payee-kind">
                <select id="payee-kind" value={kind} onChange={(ev) => setKind(ev.target.value as PayeeKind)} className={inputClass}>
                  {KINDS.map((k) => <option key={k} value={k}>{common.status.payeeKind[k]}</option>)}
                </select>
              </Field>
              <Field label={copy.payees.wallet} htmlFor="payee-wallet" hint={copy.payees.walletHint} error={error}>
                <input id="payee-wallet" value={wallet} onChange={(ev) => setWallet(ev.target.value)} className={`${inputClass} font-mono`} autoComplete="off" spellCheck={false} aria-describedby={error ? "payee-wallet-error" : "payee-wallet-hint"} />
              </Field>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setAdding(false)}>{copy.payees.cancel}</Button>
                <Button type="submit" className="flex-1" loading={busy === "payee"}>{copy.payees.submit}</Button>
              </div>
            </form>
          )}
        </Card>

        <Card className="md:col-span-2">
          <div className="flex items-start gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-bg"><Bot className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <h2 className="text-h3">{copy.agent.title}</h2>
              <p className="mt-1 text-ink-2">{copy.agent.body}</p>
              <p className="mt-2 text-small text-ink-2">{copy.wallet}: <span className="font-mono">{shortAddress(e.agent, 6)}</span></p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
