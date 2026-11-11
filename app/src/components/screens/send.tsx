"use client";
import { useEffect, useState, type FormEvent } from "react";
import clsx from "clsx";
import { ArrowRight, Check, CircleAlert, Delete, Sparkles, UserRoundPlus, Wallet } from "@/components/ui/icons";
import type { ScreensCopy } from "@/content/screens";
import { useLocalized } from "@/lib/i18n/client";
import type { SavedRecipient } from "@/lib/types";
import { formatUsdt, formatZar, fromBase, toBase } from "@/lib/format";
import { useEstate } from "@/lib/hooks/estate";
import { describeResult, interpretRequest, reviewLabel } from "@/lib/assistant/client";
import type { IntentEngine } from "@/lib/assistant/intent";
import { Badge, Button, ButtonLink, Card, Field, inputClass, Notice, PageHeader, Skeleton } from "@/components/ui/primitives";
import { usePay } from "@/components/pay/payment";
import { Avatar } from "@/components/shell/app-shell";
import { fmt, useCopy } from "@/components/shell/copy";
import { Gate } from "@/components/shell/gate";

type Copy = ScreensCopy["send"];
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"] as const;

export function SendScreen({ copy: english }: { copy: Copy }) {
  const copy = useLocalized(english, (t) => t.screens.send);
  return <Gate allowEmpty>{() => <Send copy={copy} />}</Gate>;
}

function Send({ copy }: { copy: Copy }) {
  const { service, fx, walletUsdt, session, explain } = useEstate();
  const { pay, online } = usePay();
  const rate = fx?.usdtZar ?? null;
  const [people, setPeople] = useState<SavedRecipient[] | null>(null);
  const [to, setTo] = useState<SavedRecipient | null>(null);
  const [other, setOther] = useState(false);
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null);
  const [fieldError, setFieldError] = useState<{ address?: string; amount?: string }>({});
  const [sent, setSent] = useState(false);
  const person = session?.address;
  const w = useCopy().assistant.wallet;
  const [ask, setAsk] = useState("");
  const [asking, setAsking] = useState(false);
  const [heard, setHeard] = useState<{ text: string; engine: IntentEngine; note: string } | null>(null);

  // A different person or service: forget the old list and choice (adjusted during render, not in an effect).
  const [seen, setSeen] = useState({ service, person });
  if (seen.service !== service || seen.person !== person) {
    setSeen({ service, person });
    setPeople(null); setTo(null);
  }

  useEffect(() => {
    let alive = true;
    if (!service) return;
    service.savedRecipients().then((r) => { if (!alive) return; setPeople(r); if (r.length === 0) setOther(true); /* nobody saved yet: go straight to the address field */ }).catch(() => { if (alive) setPeople([]); });
    return () => { alive = false; };
  }, [service, person]);

  const n = Number(amount);
  const valid = Number.isFinite(n) && n > 0;
  const press = (k: (typeof KEYS)[number]) => {
    setFieldError((e) => ({ ...e, amount: undefined })); setProblem(null);
    setAmount((a) => {
      if (k === "del") return a.slice(0, -1);
      if (k === ".") return a.includes(".") ? a : (a || "0") + ".";
      if (a.includes(".") && a.split(".")[1].length >= 2) return a;
      return a === "0" ? k : (a + k).slice(0, 9);
    });
  };

  const review = async () => {
    if (!service || busy) return; // one request at a time: no double-submit
    const dest = other ? address.trim() : to?.address ?? "";
    const errs = { address: dest ? undefined : copy.addressError, amount: valid ? undefined : copy.amountError };
    setFieldError(errs);
    if (errs.address || errs.amount) return;
    setBusy(true); setProblem(null);
    try {
      const r = await service.reviewSend({ to: dest, toLabel: other ? "" : to?.label ?? "", amountUsdt: n });
      setBusy(false);
      const res = await pay({ kind: "p2p", to: r.to, toLabel: r.toLabel, amount: r.amount, review: r });
      if (res.ok) { setSent(true); setAmount(""); }
    } catch (e) {
      setProblem(explain(e));
      setBusy(false);
    }
  };

  // "Send R500 to Lerato for books": QVAC (or the fallback parser) reads it, the app checks the person and the
  // rate, fills the form below, and opens the same review sheet. Nothing is sent until the person approves.
  const askWallet = async (e: FormEvent) => {
    e.preventDefault();
    if (!service || asking || busy || !ask.trim()) return;
    setAsking(true); setHeard(null); setProblem(null); setFieldError({});
    try {
      const r = await interpretRequest(ask, service, rate, w);
      setHeard({ text: describeResult(r, w), engine: r.engine, note: r.note });
      const p = r.plan;
      const usdt = p.ok ? p.amountUsdt : p.intent.amountUsdt ?? (p.intent.amountZar && r.rate ? Math.round((p.intent.amountZar / r.rate) * 100) / 100 : null);
      if (usdt) setAmount(String(usdt));
      if (!p.ok) return;
      const saved = r.recipients.find((x) => x.address === p.to);
      if (saved) { setTo(saved); setOther(false); } else { setOther(true); setAddress(p.to); }
      setAsking(false);
      const rv = await service.reviewSend({ to: p.to, toLabel: reviewLabel(p, w), amountUsdt: p.amountUsdt });
      const res = await pay({ kind: "p2p", to: rv.to, toLabel: rv.toLabel, amount: rv.amount, review: rv });
      if (res.ok) { setSent(true); setAmount(""); setAsk(""); setHeard(null); }
    } catch (err) {
      setProblem(explain(err));
    } finally {
      setAsking(false);
    }
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-md py-8 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-ink text-bg"><Check className="size-8" strokeWidth={3} aria-hidden="true" /></span>
        <h1 className="mt-4 text-h2" role="status">{copy.sentTitle}</h1>
        <div className="mt-6 flex flex-col gap-3">
          <Button onClick={() => setSent(false)}>{copy.again}</Button>
          <ButtonLink href="/estate" variant="secondary">{copy.toEstate}</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} body={copy.body} />
      <p className="mb-4 flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2 text-small"><Wallet className="size-4 text-accent" aria-hidden="true" />{copy.wallet}: <span className="font-semibold tabular-nums">{formatUsdt(walletUsdt)}</span></p>

      <Card className="mb-4">
        <form onSubmit={askWallet}>
          <Field label={w.title} htmlFor="ask-wallet" hint={w.hint}>
            <div className="flex gap-2">
              <input id="ask-wallet" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={w.placeholder} aria-describedby="ask-wallet-hint" autoComplete="off" enterKeyHint="send" maxLength={500} className={`${inputClass} min-w-0 flex-1`} />
              <Button type="submit" loading={asking} disabled={!ask.trim()} aria-label={asking ? w.asking : w.ask}>{!asking && <Sparkles className="size-5" aria-hidden="true" />}<span className="max-sm:sr-only">{w.ask}</span></Button>
            </div>
          </Field>
        </form>
        {heard && (
          <div role="status" aria-live="polite" className="mt-3 text-small">
            <Badge tone={heard.engine === "qvac" ? "accent" : "neutral"}><Sparkles className="size-3.5" aria-hidden="true" />{heard.engine === "qvac" ? w.engineQvac : w.engineFallback}</Badge>
            <p className="mt-1.5">{heard.text}</p>
            {heard.note && <p className="mt-1 text-[0.75rem] text-ink-2">{heard.note}</p>}
          </div>
        )}
      </Card>

      <Card>
        <fieldset className="min-w-0">
          <legend className="mb-2 font-semibold">{copy.recipients}</legend>
          {people === null ? (
            <div role="status" className="flex gap-2"><span className="sr-only">{copy.recipientsLoading}</span><Skeleton className="h-20 w-20" /><Skeleton className="h-20 w-20" /><Skeleton className="h-20 w-20" /></div>
          ) : (
            <div className="relative -mx-1 flex gap-1 overflow-x-auto px-1 pb-2">
              {people.map((p) => {
                const on = !other && to?.address === p.address;
                return (
                  <label key={p.address} className={clsx("relative flex w-[5.25rem] shrink-0 cursor-pointer flex-col items-center gap-1 rounded-md border p-2 text-center has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]", on ? "border-accent bg-accent-soft" : "border-transparent hover:bg-surface-2")}>
                    <input type="radio" name="send-to" className="sr-only" checked={on} onChange={() => { setTo(p); setOther(false); setFieldError({}); setProblem(null); }} />
                    <Avatar name={p.label} role={p.relationship?.includes("trusted") || p.relationship === "executor" ? "verifier" : p.relationship === "estate owner" ? "owner" : "beneficiary"} className="size-11" />
                    <span className="w-full truncate text-small font-semibold">{p.label.replace(/^(Adv\.|Ms\.|Mr\.|Uncle)\s+/i, "").split(" ")[0]}</span>
                    <span className="w-full truncate text-[0.7rem] text-ink-2">{p.relationship}</span>
                  </label>
                );
              })}
              <label className={clsx("relative flex w-[5.25rem] shrink-0 cursor-pointer flex-col items-center gap-1 rounded-md border p-2 text-center has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]", other ? "border-accent bg-accent-soft" : "border-transparent hover:bg-surface-2")}>
                <input type="radio" name="send-to" className="sr-only" checked={other} onChange={() => { setOther(true); setFieldError({}); setProblem(null); }} />
                <span className="grid size-11 place-items-center rounded-full bg-surface-2"><UserRoundPlus className="size-5" aria-hidden="true" /></span>
                <span className="text-small font-semibold">{copy.other}</span>
              </label>
            </div>
          )}
          {people?.length === 0 && !other && <p className="text-small text-ink-2">{copy.recipientsEmpty}</p>}
        </fieldset>
        {other && (
          <Field label={copy.address} htmlFor="send-address" hint={copy.addressHint} error={fieldError.address} className="mt-3">
            <input id="send-address" value={address} onChange={(e) => { setAddress(e.target.value); setFieldError({}); setProblem(null); }} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={!!fieldError.address} aria-describedby={fieldError.address ? "send-address-error" : "send-address-hint"} className={`${inputClass} font-mono text-small`} />
          </Field>
        )}
        {!other && fieldError.address && <p role="alert" className="mt-2 border-l-4 border-ink pl-2 text-small font-semibold text-ink">{fieldError.address}</p>}

        <div className="mt-5 text-center">
          <p id="send-amount-label" className="text-small font-semibold">{copy.amount}</p>
          <p className="mt-1 font-display text-display leading-none tabular-nums" aria-live="polite" aria-label={fmt(copy.amountSr, { amount: amount || "0" })}>{amount || "0"}<span className="ml-2 text-h3 text-ink-2">USD₮</span></p>
          <p className="mt-1 min-h-6 text-ink-2 tabular-nums">{valid && rate ? fmt(copy.zar, { zar: formatZar(toBase(n), rate) }) : ""}</p>
          {fieldError.amount && <p role="alert" className="border-l-4 border-ink pl-2 text-small font-semibold text-ink">{fieldError.amount}</p>}
        </div>
        <div role="group" aria-label={copy.quick} className="mt-2 flex justify-center gap-2">
          {[50, 100, 500].map((q) => (
            <button key={q} type="button" onClick={() => { setAmount(String(q)); setProblem(null); setFieldError({}); }} className="min-h-11 rounded-full border border-line-strong/70 px-4 text-small font-medium tabular-nums hover:bg-surface-2">{q}</button>
          ))}
          <button type="button" onClick={() => { setAmount(String(fromBase(walletUsdt))); setProblem(null); }} className="min-h-11 rounded-full border border-line-strong/70 px-4 text-small font-medium hover:bg-surface-2">{copy.max}</button>
        </div>
        <div role="group" aria-label={copy.pad} className="mx-auto mt-3 grid max-w-xs grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button key={k} type="button" onClick={() => press(k)} aria-label={k === "del" ? copy.backspace : undefined} className="grid min-h-14 place-items-center rounded-md bg-surface-2 font-display text-h3 tabular-nums transition-transform hover:bg-line active:scale-95">
              {k === "del" ? <Delete className="size-6" aria-hidden="true" /> : k}
            </button>
          ))}
        </div>

        {problem && (
          <Notice tone="danger" icon={<CircleAlert className="size-5" aria-hidden="true" />} title={copy.problem} className="mt-4">
            <p role="alert">{problem.message}</p>
            <Button small variant="secondary" className="mt-2" onClick={() => { if (problem.code === "InvalidAddress") { setOther(true); document.getElementById("send-address")?.focus(); } else setAmount(""); setProblem(null); }}>
              {problem.code === "InvalidAddress" ? copy.fixAddress : copy.fixAmount}
            </Button>
          </Notice>
        )}

        <Button block className="mt-4 min-h-13!" loading={busy} disabled={!online} onClick={review}>{busy ? copy.reviewing : copy.review}{!busy && <ArrowRight className="size-5" aria-hidden="true" />}</Button>
        <p className="mt-3 text-center text-[0.75rem] text-ink-2">{copy.note}</p>
      </Card>
    </div>
  );
}
