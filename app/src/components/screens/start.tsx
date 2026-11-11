"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Copy, KeyRound, ShieldCheck, TriangleAlert, UsersRound, Wallet } from "lucide-react";
import type { ScreensCopy } from "@/content/screens";
import type { Role } from "@/lib/types";
import { useWallet } from "@/lib/hooks/wallet-source";
import { useEstate } from "@/lib/hooks/estate";
import { Badge, Button, Card, Consent, Eyebrow, Field, inputClass, Notice } from "@/components/ui/primitives";
import { fmt, useCopy } from "@/components/shell/copy";
import { usePin } from "@/components/shell/pin-gate";

type Step = "choose" | "about" | "pin" | "seed";
const ROLES: Exclude<Role, "agent">[] = ["owner", "beneficiary", "verifier", "buyer"];

export function StartScreen({ copy }: { copy: ScreensCopy["start"] }) {
  const { common } = useCopy();
  const router = useRouter();
  const wallet = useWallet();
  const pinGate = usePin();
  const { snap, isMock } = useEstate();
  const [step, setStep] = useState<Step>("choose");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Exclude<Role, "agent">>("owner");
  const [importing, setImporting] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [consent, setConsent] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seed, setSeed] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") setStep("about");
  }, []);

  const owner = wallet.sessions.find((s) => s.role === "owner");
  const home = (r: Role) => (r === "owner" ? (snap ? "/estate" : "/will") : r === "buyer" ? "/car" : "/estate");

  const startDemo = () => {
    if (!owner) return;
    if (!snap) wallet.switchTo(owner.address);
    router.push(snap ? "/estate" : "/will");
  };

  const submitAbout = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError(copy.form.nameError); return; }
    if (importing && phrase.trim().split(/\s+/).length < 12) { setError(copy.form.importHint); return; }
    if (!consent) { setError(common.consentRequired); return; }
    setError(null);
    setStep("pin");
  };

  const submitPin = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6,}$/.test(pin)) { setError(copy.pin.invalid); return; }
    if (pin !== pin2) { setError(copy.pin.mismatch); return; }
    setError(null);
    setBusy(true);
    try {
      pinGate.preset(pin);
      if (importing) {
        await wallet.importSeed(name.trim(), role, phrase.trim().toLowerCase().replace(/\s+/g, " "));
        router.push(home(role));
      } else {
        const { seedPhrase } = await wallet.create(name.trim(), role);
        setSeed(seedPhrase.split(/\s+/));
        setStep("seed");
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : copy.error);
    } finally {
      pinGate.preset(null);
      setPin(""); setPin2("");
      setBusy(false);
    }
  };

  const stepIndex = step === "about" ? 1 : step === "pin" ? 2 : 3;

  return (
    <div className="mx-auto w-full max-w-xl">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
          {step === "choose" && (
            <>
              <Eyebrow>{copy.eyebrow}</Eyebrow>
              <h1 className="mt-2 text-h1">{copy.title}</h1>
              <p className="mt-3 text-lead text-ink-2">{copy.body}</p>
              <div className="mt-6 grid gap-4">
                <Card className="border-accent/40 bg-accent-soft/60">
                  <div className="flex items-start gap-3.5">
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-ink"><UsersRound className="size-6" aria-hidden="true" /></span>
                    <div className="min-w-0">
                      <h2 className="text-h3">{copy.demo.title}</h2>
                      <p className="mt-1 text-ink-2">{copy.demo.body}</p>
                    </div>
                  </div>
                  {owner ? (
                    <Button block className="mt-4" onClick={startDemo} disabled={!wallet.ready}>
                      {snap ? copy.demo.resume : copy.demo.cta}<ArrowRight className="size-5" aria-hidden="true" />
                    </Button>
                  ) : wallet.ready && !isMock ? (
                    <p className="mt-3 text-small text-ink-2">{copy.demo.unavailable}</p>
                  ) : null}
                </Card>
                <Card>
                  <div className="flex items-start gap-3.5">
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-2 text-ink"><Wallet className="size-6" aria-hidden="true" /></span>
                    <div className="min-w-0">
                      <h2 className="text-h3">{copy.create.title}</h2>
                      <p className="mt-1 text-ink-2">{copy.create.body}</p>
                    </div>
                  </div>
                  <Button variant="secondary" block className="mt-4" onClick={() => setStep("about")}>{copy.create.cta}</Button>
                </Card>
              </div>
            </>
          )}

          {step !== "choose" && (
            <>
              <ol className="mb-5 flex items-center gap-2" aria-label={fmt(copy.stepLabel, { n: stepIndex, total: 3, name: copy.steps[stepIndex - 1] })}>
                {copy.steps.map((s, i) => (
                  <li key={s} aria-current={i + 1 === stepIndex ? "step" : undefined} className="flex flex-1 flex-col gap-1.5">
                    <span className={`h-1.5 rounded-full ${i + 1 <= stepIndex ? "bg-accent" : "bg-line"}`} />
                    <span className={`text-[0.75rem] font-semibold ${i + 1 === stepIndex ? "text-ink" : "text-ink-2"}`}>{s}</span>
                  </li>
                ))}
              </ol>
            </>
          )}

          {step === "about" && (
            <form onSubmit={submitAbout} noValidate className="flex flex-col gap-4">
              <h1 className="text-h2">{copy.form.title}</h1>
              <Field label={copy.form.name} htmlFor="start-name" hint={copy.form.nameHint}>
                <input id="start-name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} aria-describedby="start-name-hint" />
              </Field>
              <fieldset>
                <legend className="mb-1.5 text-small font-semibold">{copy.form.role}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ROLES.map((r) => (
                    <label key={r} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)] ${role === r ? "border-accent bg-accent-soft" : "border-line-strong/70 bg-surface"}`}>
                      <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="size-4 accent-[var(--accent)]" />
                      <span className="text-small font-medium">{copy.form.roles[r]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-small font-medium">
                <input type="checkbox" checked={importing} onChange={(e) => setImporting(e.target.checked)} className="size-5 accent-[var(--accent)]" />
                {copy.form.importToggle}
              </label>
              {importing && (
                <Field label={copy.form.importLabel} htmlFor="start-phrase" hint={copy.form.importHint}>
                  <textarea id="start-phrase" rows={3} autoComplete="off" autoCapitalize="none" spellCheck={false} value={phrase} onChange={(e) => setPhrase(e.target.value)} className={`${inputClass} py-3 font-mono`} aria-describedby="start-phrase-hint" />
                </Field>
              )}
              <Consent id="start-consent" checked={consent} onChange={setConsent} copy={common.consent} />
              {error && <p role="alert" className="text-small font-medium text-danger">{error}</p>}
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => { setError(null); setStep("choose"); }}><ArrowLeft className="size-4" aria-hidden="true" />{copy.form.back}</Button>
                <Button type="submit" className="flex-1">{copy.form.next}</Button>
              </div>
            </form>
          )}

          {step === "pin" && (
            <form onSubmit={submitPin} noValidate className="flex flex-col gap-4">
              <div>
                <h1 className="text-h2">{copy.pin.title}</h1>
                <p className="mt-2 text-ink-2">{copy.pin.body}</p>
              </div>
              <Field label={copy.pin.label} htmlFor="start-pin" hint={copy.pin.hint}>
                <input id="start-pin" type="password" inputMode="numeric" autoComplete="new-password" required autoFocus value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className={`${inputClass} font-mono text-h3 tracking-[0.4em]`} aria-describedby="start-pin-hint" />
              </Field>
              <Field label={copy.pin.confirm} htmlFor="start-pin2">
                <input id="start-pin2" type="password" inputMode="numeric" autoComplete="new-password" required value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} className={`${inputClass} font-mono text-h3 tracking-[0.4em]`} />
              </Field>
              {error && <p role="alert" className="text-small font-medium text-danger">{error}</p>}
              <p role="status" aria-live="polite" className="sr-only">{busy ? copy.pin.creating : ""}</p>
              <div className="flex gap-3">
                <Button variant="secondary" disabled={busy} onClick={() => { setError(null); setStep("about"); }}><ArrowLeft className="size-4" aria-hidden="true" />{copy.form.back}</Button>
                <Button type="submit" className="flex-1" loading={busy}><KeyRound className="size-5" aria-hidden="true" />{busy ? copy.pin.creating : importing ? copy.pin.importCta : copy.pin.create}</Button>
              </div>
            </form>
          )}

          {step === "seed" && seed && (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-h2">{copy.seed.title}</h1>
                <p className="mt-2 text-ink-2">{copy.seed.body}</p>
              </div>
              <ol aria-label={copy.seed.listLabel} className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-3">
                {seed.map((w, i) => (
                  <li key={`${w}-${i}`} className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2.5">
                    <span className="w-5 text-right text-small tabular-nums text-ink-2">{i + 1}</span>
                    <span className="font-mono font-medium">{w}</span>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone="accent"><ShieldCheck className="size-4" aria-hidden="true" />{copy.seed.wdk}</Badge>
                <Button variant="ghost" small onClick={async () => { try { await navigator.clipboard.writeText(seed.join(" ")); setCopied(true); } catch { /* clipboard blocked */ } }}>
                  {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}{copy.seed.copy}
                </Button>
              </div>
              <p role="status" className="text-small text-ink-2">{copied ? copy.seed.copied : ""}</p>
              <Notice tone="warn" icon={<TriangleAlert className="size-5" aria-hidden="true" />}>{copy.seed.warning}</Notice>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 text-small font-medium">
                <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
                {copy.seed.confirm}
              </label>
              <Button disabled={!saved} onClick={() => { setSeed(null); router.push(home(role)); }}>{copy.seed.done}<ArrowRight className="size-5" aria-hidden="true" /></Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
