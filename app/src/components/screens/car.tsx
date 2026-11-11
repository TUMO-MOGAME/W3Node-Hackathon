"use client";
import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import clsx from "clsx";
import { motion } from "motion/react";
import { ArrowRight, CarFront, Check, FileText, Gavel, HandHeart, Loader2, Lock, ShieldCheck, Sparkles, Store } from "lucide-react";
import type { ScreensCopy } from "@/content/screens";
import { useLocalized } from "@/lib/i18n/client";
import type { EstateSnapshot } from "@/lib/service";
import type { Asset, CarValuation, OfferRanking, Role, WalletSession } from "@/lib/types";
import { formatUsdt, formatZar, fromBase, toBase } from "@/lib/format";
import { useEstate } from "@/lib/hooks/estate";
import { useNow } from "@/lib/hooks/use-now";
import { Badge, Button, ButtonLink, Card, Consent, EmptyState, Eyebrow, ExplorerLink, Field, inputClass, Money, Notice, PageHeader } from "@/components/ui/primitives";
import { FilePicker, Quorum } from "@/components/ui/client";
import { SpecialistChip } from "@/components/agent/chat-parts";
import { Blocked } from "@/components/shell/blocked";
import { fmt, useCopy } from "@/components/shell/copy";
import { Gate } from "@/components/shell/gate";
import { usePay } from "@/components/pay/payment";
import { clock } from "./family";

type Copy = ScreensCopy["car"];
const num = (s: string) => Number(s.replace(/[\s,]/g, ""));

export function CarScreen({ copy: english }: { copy: Copy }) {
  const copy = useLocalized(english, (t) => t.screens.car);
  return (
    <Gate>
      {({ snap, session, role }) => {
        const car = snap!.assets[0];
        if (car) return <Listing copy={copy} snap={snap!} car={car} session={session} role={role} />;
        if (role === "owner" && snap!.estate.status === "Active") return <Register copy={copy} snap={snap!} />;
        return <EmptyState icon={<CarFront className="size-6" aria-hidden="true" />} title={copy.emptyTitle} body={copy.emptyBody} />;
      }}
    </Gate>
  );
}

/* ---------- Owner: add the car, with an AI valuation ---------- */

function Register({ copy, snap }: { copy: Copy; snap: EstateSnapshot }) {
  const { common, assistant } = useCopy();
  const { service, fx, run, busy, explain } = useEstate();
  const r = copy.register;
  const rate = fx?.usdtZar ?? null;
  const [make, setMake] = useState<string>(r.defaults.make);
  const [model, setModel] = useState<string>(r.defaults.model);
  const [year, setYear] = useState<string>(r.defaults.year);
  const [mileage, setMileage] = useState<string>(r.defaults.mileage);
  const [condition, setCondition] = useState<string>(r.conditions[1]);
  const [valuing, setValuing] = useState(false);
  const [valuation, setValuation] = useState<CarValuation | null>(null);
  const [asking, setAsking] = useState("");
  const [floor, setFloor] = useState("");
  const [hardship, setHardship] = useState("");
  const [doc, setDoc] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = async (ev?: FormEvent) => {
    ev?.preventDefault();
    if (!service) return;
    setValuing(true); setError(null);
    try {
      const v = await service.valueCar({ make, model, year: Number(year), mileageKm: num(mileage), condition });
      setValuation(v);
      setAsking(String(v.suggestedAskingUsdt));
      setFloor(String(v.lowUsdt));
      setHardship(String(Math.round(v.lowUsdt * 0.83 / 50) * 50));
    } catch (e) {
      setError(explain(e).message);
    } finally {
      setValuing(false);
    }
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const a = num(asking), f = num(floor), h = num(hardship);
    if (!(h > 0 && f >= h && a >= f)) { setError(r.orderError); return; }
    if (!consent) { setError(common.consentRequired); return; }
    setError(null);
    await run("register", (s, est) => s.registerAsset(est, {
      nftMint: "", title: `${year} ${make} ${model}`, floorUsdt: f, hardshipFloorUsdt: h, askingUsdt: a, proceedsTo: snap.estate.address, docFile: doc ?? undefined,
    }), r.added);
  };

  const zar = (s: string) => (rate && num(s) > 0 ? fmt(r.zar, { zar: formatZar(toBase(num(s)), rate) }) : undefined);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow={copy.eyebrow} title={r.title} body={r.body} />
      <Card>
        <form onSubmit={value} className="grid gap-3 sm:grid-cols-2">
          <Field label={r.make} htmlFor="car-make"><input id="car-make" required value={make} onChange={(e) => setMake(e.target.value)} className={inputClass} /></Field>
          <Field label={r.model} htmlFor="car-model"><input id="car-model" required value={model} onChange={(e) => setModel(e.target.value)} className={inputClass} /></Field>
          <Field label={r.year} htmlFor="car-year"><input id="car-year" required inputMode="numeric" pattern="\d{4}" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} className={inputClass} /></Field>
          <Field label={r.mileage} htmlFor="car-km"><input id="car-km" required inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value.replace(/[^\d\s]/g, ""))} className={inputClass} /></Field>
          <Field label={r.condition} htmlFor="car-cond" className="sm:col-span-2">
            <select id="car-cond" value={condition} onChange={(e) => setCondition(e.target.value)} className={inputClass}>
              {r.conditions.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Button type="submit" variant={valuation ? "secondary" : "primary"} loading={valuing} className="sm:col-span-2">
            <Sparkles className="size-5" aria-hidden="true" />{valuing ? r.valuing : valuation ? r.revalue : r.value}
          </Button>
        </form>
        <p className="sr-only" role="status" aria-live="polite">{valuing ? r.valuing : valuation ? `${r.valuationTitle}: ${valuation.suggestedAskingUsdt} USD₮` : ""}</p>
      </Card>

      {valuation && !valuing && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 grid gap-4">
          <Card className="border-accent/30 bg-accent-soft/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow>{r.valuationTitle}</Eyebrow>
              <SpecialistChip name="CarBroker" copy={assistant} />
            </div>
            <Money base={toBase(valuation.suggestedAskingUsdt)} rate={rate} size="xl" className="mt-1" />
            <p className="mt-1 text-small text-ink-2">{fmt(r.range, { low: formatUsdt(toBase(valuation.lowUsdt), { decimals: 0 }), high: formatUsdt(toBase(valuation.highUsdt), { decimals: 0 }) })}</p>
            <p className="mt-3">{valuation.rationale}</p>
            <h3 className="mt-4 font-sans text-small font-semibold uppercase tracking-[0.12em] text-ink-2">{r.comparables}</h3>
            <ul className="mt-1">
              {valuation.comparables.map((c) => (
                <li key={c.title} className="flex items-center justify-between gap-3 border-b border-line/70 py-2 text-small last:border-0">
                  <span className="min-w-0"><span className="block truncate font-medium">{c.title}</span><span className="text-ink-2">{c.source}</span></span>
                  <span className="shrink-0 font-semibold tabular-nums">R {c.priceZar.toLocaleString("en-ZA")}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="text-h3">{r.pricesTitle}</h2>
            <form onSubmit={submit} noValidate className="mt-3 flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={r.asking} htmlFor="car-asking" hint={zar(asking)}><input id="car-asking" inputMode="numeric" value={asking} onChange={(e) => setAsking(e.target.value.replace(/[^\d\s]/g, ""))} className={`${inputClass} tabular-nums`} /></Field>
                <Field label={r.floor} htmlFor="car-floor" hint={zar(floor) ?? r.floorHint}><input id="car-floor" inputMode="numeric" value={floor} onChange={(e) => setFloor(e.target.value.replace(/[^\d\s]/g, ""))} className={`${inputClass} tabular-nums`} /></Field>
                <Field label={r.hardship} htmlFor="car-hard" hint={zar(hardship) ?? r.hardshipHint}><input id="car-hard" inputMode="numeric" value={hardship} onChange={(e) => setHardship(e.target.value.replace(/[^\d\s]/g, ""))} className={`${inputClass} tabular-nums`} /></Field>
              </div>
              <p className="text-small text-ink-2">{r.floorHint} {r.hardshipHint}</p>
              <FilePicker id="car-doc" label={r.doc} hint={r.docHint} file={doc} onFile={setDoc} samples={r.docSamples} copy={common.file} />
              <Consent id="car-consent" checked={consent} onChange={(v) => { setConsent(v); setError(null); }} copy={common.consent} />
              {error && <p role="alert" className="text-small font-medium text-danger">{error}</p>}
              <Button type="submit" loading={busy === "register"}><Lock className="size-5" aria-hidden="true" />{r.submit}</Button>
              <p className="text-small text-ink-2">{r.titleNote}</p>
            </form>
          </Card>
        </motion.div>
      )}
      {error && !valuation && <p role="alert" className="mt-3 text-small font-medium text-danger">{error}</p>}
    </div>
  );
}

/* ---------- Listing, offers, the floor rule and the sale ---------- */

function Listing({ copy, snap, car, session, role }: { copy: Copy; snap: EstateSnapshot; car: Asset; session: WalletSession; role: Role }) {
  const { common } = useCopy();
  const { service, fx, run, busy } = useEstate();
  const now = useNow();
  const rate = fx?.usdtZar ?? null;
  const e = snap.estate;
  const offers = snap.offers.filter((o) => o.asset === car.address).sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
  const mine = offers.find((o) => o.buyer === session.address);
  const hardship = snap.hardships.find((h) => h.asset === car.address && (h.status === "Open" || h.status === "Approved"));
  const hardshipName = car.hardshipBeneficiary ? (snap.beneficiaries.find((b) => b.wallet === car.hardshipBeneficiary)?.label.split(" ")[0] ?? "") : "";
  const sale = car.status === "Sold" ? snap.activity.find((a) => a.kind === "AssetSold") : undefined;
  const isFamily = snap.beneficiaries.some((b) => b.wallet === session.address);
  const isVerifier = e.verifiers.includes(session.address);
  const [blocked, setBlocked] = useState<{ code: string; message: string } | null>(null);
  const [ranking, setRanking] = useState<OfferRanking | null>(null);
  const offersKey = offers.map((o) => `${o.address}:${o.amount}`).join("|") + (car.hardshipBeneficiary ?? "");

  useEffect(() => {
    let alive = true;
    if (!service || offers.length === 0) { setRanking(null); return; }
    service.rankOffers(car.address).then((r) => { if (alive) setRanking(r); }).catch(() => { if (alive) setRanking(null); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, offersKey, car.address]);

  useEffect(() => { setBlocked(null); }, [offersKey]);

  const settle = async () => {
    setBlocked(null);
    const res = await run("settle", (s, est) => s.acceptBestOffer(est, car.address), copy.settle.done, true);
    if (!res.ok) setBlocked({ code: res.code, message: res.message });
  };

  const statusOf = (addr: string, amount: bigint) => {
    if (car.status === "Sold") return { tone: "neutral" as const, text: copy.offers.notChosen };
    if (ranking?.bestOffer === addr) return { tone: "ok" as const, text: copy.offers.leading };
    const el = ranking?.eligible.find((x) => x.offer === addr);
    if (el) return { tone: "accent" as const, text: copy.offers.canWin };
    if (amount < car.hardshipFloor) return { tone: "danger" as const, text: copy.offers.blockedHard };
    if (amount < (car.hardshipBeneficiary ? car.hardshipFloor : car.floorPrice)) return { tone: "danger" as const, text: copy.offers.blocked };
    return { tone: "accent" as const, text: copy.offers.canWin };
  };
  const reasonOf = (addr: string) => car.status === "Sold" ? undefined : ranking?.eligible.find((x) => x.offer === addr)?.reason ?? ranking?.ineligible.find((x) => x.offer === addr)?.reason;
  const remaining = car.status === "Listed" && car.listingEnds && now !== null ? car.listingEnds - now : null;

  return (
    <div className="grid gap-5 *:min-w-0 lg:grid-cols-[1.1fr_1fr] lg:items-start">
      <div className="grid gap-5 *:min-w-0">
        <Card className="overflow-hidden p-0! sm:p-0!">
          <div className="relative aspect-[32/15] w-full bg-surface-2">
            <Image src={car.imageUrl ?? "/car-corolla.svg"} alt={fmt(copy.imageAlt, { title: car.title })} fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" unoptimized priority />
            <span className="absolute left-3 top-3"><Badge tone={car.status === "Sold" ? "ok" : car.status === "Listed" ? "warn" : "neutral"} className="shadow-card">{common.status.asset[car.status]}</Badge></span>
          </div>
          <div className="p-4 sm:p-5">
            <Eyebrow>{copy.eyebrow}</Eyebrow>
            <h1 className="mt-1 text-h2">{car.title}</h1>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-small text-ink-2">{copy.asking}</p>
                <Money base={car.askingPrice} rate={rate} size="lg" />
              </div>
              {car.status === "Listed" && (
                <p className="min-h-6 rounded-full bg-surface-2 px-3 py-1 text-small font-medium tabular-nums" role="timer" aria-live="off">
                  {remaining === null ? "" : remaining > 0 ? fmt(copy.endsIn, { time: clock(remaining) }) : copy.ended}
                </p>
              )}
            </div>
          </div>
        </Card>

        {car.status === "Sold" && sale && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="border-ok/40 bg-ok-soft">
              <p className="flex items-center gap-2 text-h3 font-display text-ok"><Check className="size-6" aria-hidden="true" />{copy.sold.title}</p>
              <p className="mt-2 font-medium">{sale.text}</p>
              <p className="mt-2 text-small text-ink-2">{copy.sold.body}</p>
              {sale.amount !== undefined && (
                <div className="mt-3"><p className="text-small text-ink-2">{copy.sold.price}</p><Money base={sale.amount} rate={rate} size="lg" /></div>
              )}
              {sale.txSignature && <ExplorerLink signature={sale.txSignature} label={copy.sold.receipt} srLabel={copy.sold.receiptSr} />}
              <h3 className="mt-3 flex items-center gap-2 font-sans text-body font-semibold tracking-normal"><FileText className="size-4" aria-hidden="true" />{copy.sold.packTitle}</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-small marker:text-ok">
                {copy.sold.pack.map((p) => <li key={p}>{p}</li>)}
              </ul>
              {offers.length > 0 && <p className="mt-3 text-small text-ink-2">{copy.sold.refund}</p>}
            </Card>
          </motion.div>
        )}

        <Protect copy={copy} car={car} offers={offers.map((o) => ({ amount: o.amount, name: o.buyerName ?? "", mine: o.buyer === session.address }))} owner={e.ownerName.split(" ")[0]} rate={rate} hardshipName={hardshipName} />
      </div>

      <div className="grid gap-5 *:min-w-0">
        {/* What this person can do */}
        {car.status === "Held" && (
          isVerifier && e.status === "Unlocked" ? (
            <Card className="border-accent/40 bg-accent-soft/60">
              <h2 className="flex items-center gap-2 text-h3"><Store className="size-5 text-accent" aria-hidden="true" />{copy.list.title}</h2>
              <p className="mt-1 text-ink-2">{copy.list.body}</p>
              <Button className="mt-3" loading={busy === "list"} onClick={() => run("list", (s, est) => s.listAsset(est, car.address, 7 * 86400), copy.list.done)}>{copy.list.cta}</Button>
            </Card>
          ) : (
            <Notice icon={<Lock className="size-5" aria-hidden="true" />}><p className="text-body">{e.status === "Unlocked" ? copy.offers.emptyHeld : copy.list.wait}</p></Notice>
          )
        )}

        {car.status === "Listed" && role === "buyer" && <OfferForm copy={copy} car={car} mine={mine?.amount ?? null} />}
        {car.status === "Listed" && role !== "buyer" && !isFamily && !isVerifier && <p className="text-small text-ink-2">{copy.offer.onlyBuyers}</p>}
        {car.status === "Sold" && mine && (
          <Card>
            <p className="font-semibold">{copy.offers.you}: {formatUsdt(mine.amount)}</p>
            <Button variant="secondary" className="mt-3" loading={busy === "withdraw"} onClick={() => run("withdraw", (s, est) => s.withdrawOffer(est, car.address), copy.offer.withdrawn)}>{copy.offer.withdraw}</Button>
          </Card>
        )}

        {car.status === "Listed" && (isVerifier || isFamily) && (
          <Card>
            <h2 className="flex items-center gap-2 text-h3"><Gavel className="size-5 text-accent" aria-hidden="true" />{copy.settle.title}</h2>
            <p className="mt-1 text-ink-2">{copy.settle.body}</p>
            <Button className="mt-3" loading={busy === "settle"} disabled={offers.length === 0} onClick={settle}>{busy === "settle" ? copy.settle.working : copy.settle.cta}</Button>
            {blocked && (
              <div className="mt-4">
                <Blocked code={blocked.code} message={blocked.message}>
                  {isFamily && !hardship && <ButtonLink href="/hardship" small variant="secondary"><HandHeart className="size-4" aria-hidden="true" />{copy.settle.hardshipLink}</ButtonLink>}
                </Blocked>
              </div>
            )}
          </Card>
        )}

        {/* Offers */}
        {car.status !== "Held" && (
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-h3">{copy.offers.title}</h2>
              <span className="text-small text-ink-2 tabular-nums">{offers.length}</span>
            </div>
            {offers.length === 0 ? <p className="mt-2 text-ink-2">{copy.offers.empty}</p> : (
              <ul className="mt-2">
                {offers.map((o) => {
                  const st = statusOf(o.address, o.amount);
                  const reason = reasonOf(o.address);
                  return (
                    <motion.li key={o.address} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="border-b border-line/70 py-3 last:border-0">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <p className="min-w-0 font-semibold">{o.buyerName ?? common.roles.buyer}{o.buyer === session.address && <span className="ml-2 text-small font-medium text-accent">({copy.offers.you})</span>}</p>
                        <Badge tone={st.tone}>{st.text}</Badge>
                      </div>
                      <p className="tabular-nums">{formatUsdt(o.amount)}{rate ? <span className="ml-2 text-small text-ink-2">≈ {formatZar(o.amount, rate)}</span> : null}</p>
                      {reason && <p className="mt-0.5 text-small text-ink-2">{reason}</p>}
                    </motion.li>
                  );
                })}
              </ul>
            )}
            {offers.length > 0 && car.status !== "Sold" && (
              <p className="mt-2 flex items-center gap-1.5 text-[0.75rem] text-ink-2" role="status">
                {ranking ? <ShieldCheck className="size-4 text-accent" aria-hidden="true" /> : <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {ranking ? copy.offers.ranking : copy.offers.rankingLoading}
              </p>
            )}
          </Card>
        )}

        {/* Hardship */}
        {hardship ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-h3"><HandHeart className="size-5 text-accent" aria-hidden="true" />{copy.hardship.title}</h2>
              <Badge tone={hardship.status === "Approved" ? "ok" : "warn"}>{common.status.hardship[hardship.status]}</Badge>
            </div>
            <p className="mt-1 text-ink-2">{fmt(copy.hardship.from, { name: snap.beneficiaries.find((b) => b.wallet === hardship.beneficiary)?.label ?? "" })}</p>
            <div className="mt-3"><Quorum approvals={hardship.approvals} needed={e.hardshipThreshold} names={e.verifierNames} label={fmt(copy.hardship.approvals, { got: hardship.approvals.filter(Boolean).length, need: e.hardshipThreshold })} /></div>
          </Card>
        ) : isFamily && car.status !== "Sold" && e.status === "Unlocked" ? (
          <Card className="bg-surface-2/50">
            <p className="text-small text-ink-2">{copy.hardship.linkBody}</p>
            <ButtonLink href="/hardship" variant="secondary" small className="mt-3"><HandHeart className="size-4" aria-hidden="true" />{copy.hardship.link}<ArrowRight className="size-4" aria-hidden="true" /></ButtonLink>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- The floor, drawn ---------- */

function Protect({ copy, car, offers, owner, rate, hardshipName }: {
  copy: Copy; car: Asset; offers: { amount: bigint; name: string; mine: boolean }[]; owner: string; rate: number | null; hardshipName: string;
}) {
  const p = copy.protect;
  const h = fromBase(car.hardshipFloor), f = fromBase(car.floorPrice), a = fromBase(car.askingPrice);
  const top = Math.max(a, ...offers.map((o) => fromBase(o.amount)));
  const bottom = Math.min(h, ...offers.map((o) => fromBase(o.amount)));
  const min = bottom - (top - bottom) * 0.12, max = top + (top - bottom) * 0.1;
  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))}%`;
  const relaxed = !!car.hardshipBeneficiary;
  const legend = [
    { swatch: "bg-danger", label: p.blockedZone, value: `< ${formatUsdt(relaxed ? car.hardshipFloor : car.floorPrice, { decimals: 0 })}` },
    ...(relaxed ? [] : [{ swatch: "bg-brass", label: p.hardshipZone, value: `${formatUsdt(car.hardshipFloor, { decimals: 0 }).replace(" USD₮", "")} – ${formatUsdt(car.floorPrice, { decimals: 0 })}` }]),
    { swatch: "bg-ok", label: p.openZone, value: `≥ ${formatUsdt(relaxed ? car.hardshipFloor : car.floorPrice, { decimals: 0 })}` },
  ];
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-h3"><ShieldCheck className="size-5 text-accent" aria-hidden="true" />{p.title}</h2>
      <p className="mt-1 text-ink-2">{fmt(p.body, { owner })}</p>
      {relaxed && <Notice tone="warn" className="mt-3"><p className="text-body">{fmt(p.hardshipOn, { name: hardshipName, floor: formatUsdt(car.hardshipFloor, { decimals: 0 }) })}</p></Notice>}

      <div className="mt-12" role="img" aria-label={p.scaleLabel}>
        <div className="relative h-4 rounded-full">
          <div className="absolute inset-0 flex overflow-hidden rounded-full">
            <span className="h-full bg-danger/75" style={{ width: pos(h) }} />
            <span className={clsx("h-full", relaxed ? "bg-ok/70" : "bg-brass/60")} style={{ width: `calc(${pos(f)} - ${pos(h)})` }} />
            <span className="h-full flex-1 bg-ok/70" />
          </div>
          {[{ v: h, label: p.hardshipFloor }, { v: f, label: p.floor }, { v: a, label: p.asking }].map((m, i) => (
            <span key={m.label} className="absolute -bottom-1.5 -top-1.5 w-0.5 bg-ink" style={{ left: pos(m.v) }}>
              <span className={clsx("absolute top-full mt-1 whitespace-nowrap text-[0.7rem] font-semibold leading-tight", i === 0 ? "left-0 -translate-x-1/4" : i === 2 ? "right-0 translate-x-1/4 text-right" : "left-1/2 -translate-x-1/2 text-center")}>
                {m.label}<br /><span className="font-normal tabular-nums text-ink-2">{m.v.toLocaleString("en-ZA")}</span>
              </span>
            </span>
          ))}
          {offers.map((o, i) => {
            const v = fromBase(o.amount);
            const ok = v >= (relaxed ? h : f);
            return (
              <motion.span
                key={`${o.name}-${i}`} initial={{ y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18, delay: i * 0.06 }}
                className={clsx("absolute bottom-full mb-1.5 grid size-7 -translate-x-1/2 place-items-center rounded-full border-2 border-surface text-[0.7rem] font-bold shadow-card", ok ? "bg-ok text-surface" : "bg-danger text-surface", o.mine && "ring-2 ring-ink")}
                style={{ left: pos(v) }} title={`${o.name}: ${v.toLocaleString("en-ZA")} USD₮`}
              >
                {o.name[0] ?? "?"}
              </motion.span>
            );
          })}
        </div>
      </div>

      <ul className="mt-14 grid gap-1.5 text-small">
        {legend.map((l) => (
          <li key={l.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2"><span className={clsx("size-3 shrink-0 rounded-full", l.swatch)} aria-hidden="true" />{l.label}</span>
            <span className="shrink-0 font-medium tabular-nums">{l.value}</span>
          </li>
        ))}
      </ul>
      {rate && <p className="mt-2 text-[0.75rem] text-ink-2">{p.floor}: ≈ {formatZar(car.floorPrice, rate)} · {p.hardshipFloor}: ≈ {formatZar(car.hardshipFloor, rate)}</p>}
    </Card>
  );
}

/* ---------- Buyer: escrowed offer ---------- */

function OfferForm({ copy, car, mine }: { copy: Copy; car: Asset; mine: bigint | null }) {
  const { common } = useCopy();
  const { fx, run, busy, walletUsdt } = useEstate();
  const o = copy.offer;
  const { pay } = usePay();
  const rate = fx?.usdtZar ?? null;
  const [amount, setAmount] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = num(amount);
  const valid = Number.isFinite(n) && n > 0;
  const spendable = walletUsdt + (mine ?? BigInt(0));

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!valid || toBase(n) > spendable) { setError(o.error); return; }
    if (!consent) { setError(common.consentRequired); return; }
    setError(null);
    const res = await pay({
      kind: "offer", to: car.address, toLabel: `${o.escrowLabel}: ${car.title}`, amount: toBase(n),
      warnings: toBase(n) < car.floorPrice ? [fmt(o.belowFloor, { floor: formatUsdt(car.floorPrice, { decimals: 0 }) })] : [],
      execute: (s, est) => s.placeOffer(est, car.address, n), successText: o.placed,
    });
    if (res.ok) setAmount("");
  };

  return (
    <Card className="border-accent/40">
      <h2 className="text-h3">{o.title}</h2>
      <p className="mt-1 text-small text-ink-2">{o.body}</p>
      {mine !== null && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-accent-soft p-3">
          <p className="font-semibold">{copy.offers.you}: <span className="tabular-nums">{formatUsdt(mine)}</span></p>
          <Button variant="secondary" small loading={busy === "withdraw"} onClick={() => run("withdraw", (s, est) => s.withdrawOffer(est, car.address), o.withdrawn)}>{o.withdraw}</Button>
        </div>
      )}
      <form onSubmit={submit} noValidate className="mt-3 flex flex-col gap-3">
        <Field label={o.amount} htmlFor="offer-amount" error={error} hint={`${valid && rate ? `${fmt(o.zar, { zar: formatZar(toBase(n), rate) })} · ` : ""}${fmt(o.wallet, { amount: formatUsdt(walletUsdt, { decimals: 0 }) })}`}>
          <div className="relative">
            <input
              id="offer-amount" inputMode="decimal" autoComplete="off" placeholder={String(fromBase(car.askingPrice))} value={amount}
              onChange={(e) => { setAmount(e.target.value.replace(/[^\d.,\s]/g, "")); setError(null); }}
              aria-invalid={!!error} aria-describedby={error ? "offer-amount-error" : "offer-amount-hint"}
              className={`${inputClass} min-h-16 pr-20 font-display text-h2 tabular-nums`}
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-semibold text-ink-2">USD₮</span>
          </div>
        </Field>
        {valid && toBase(n) < car.floorPrice && (
          <Notice tone="warn"><p role="status">{fmt(o.belowFloor, { floor: formatUsdt(car.floorPrice, { decimals: 0 }) })}</p></Notice>
        )}
        <Consent id="offer-consent" checked={consent} onChange={(v) => { setConsent(v); setError(null); }} copy={common.consent} />
        <Button type="submit" disabled={!!busy} className="min-h-13!"><Lock className="size-5" aria-hidden="true" />{mine !== null ? o.update : o.submit}</Button>
      </form>
    </Card>
  );
}
