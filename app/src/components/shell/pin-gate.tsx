"use client";
import { createContext, useCallback, useContext, useRef, useState, type FormEvent, type ReactNode } from "react";
import { WalletProvider, type PinReason, type RequestPin } from "@/lib/hooks/wallet-source";
import { Sheet } from "@/components/ui/client";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { fmt, useCopy } from "./copy";

interface PinApi { /** Hand over a PIN the user just chose during onboarding, so wallet creation doesn't ask twice. */ preset(pin: string | null): void }
const Ctx = createContext<PinApi>({ preset: () => undefined });
export const usePin = () => useContext(Ctx);

/** Wraps the wallet layer and supplies its PIN prompt as an accessible sheet instead of window.prompt. */
export function PinGate({ children }: { children: ReactNode }) {
  const { common } = useCopy();
  const c = common.pin;
  const presetPin = useRef<string | null>(null);
  const [req, setReq] = useState<{ reason: PinReason; label: string; resolve: (pin: string | null) => void } | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const requestPin = useCallback<RequestPin>((reason, label) => {
    if (reason === "create" && presetPin.current) {
      const p = presetPin.current;
      presetPin.current = null;
      return Promise.resolve(p);
    }
    setPin(""); setError(null);
    return new Promise((resolve) => setReq({ reason, label, resolve }));
  }, []);

  const finish = (value: string | null) => { req?.resolve(value); setReq(null); setPin(""); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6,}$/.test(pin)) { setError(c.invalid); return; }
    finish(pin);
  };

  const [api] = useState<PinApi>(() => ({ preset: (p) => { presetPin.current = p; } }));

  return (
    <Ctx.Provider value={api}>
      <WalletProvider requestPin={requestPin}>{children}</WalletProvider>
      <Sheet open={!!req} onClose={() => finish(null)} title={c.unlockTitle} description={req ? fmt(c.unlockBody, { label: req.label }) : undefined} closeLabel={c.cancel}>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label={c.label} htmlFor="pin-unlock" hint={c.hint} error={error}>
            <input
              id="pin-unlock" type="password" inputMode="numeric" autoComplete="current-password" pattern="\d{6,}" required autoFocus
              value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setError(null); }}
              aria-invalid={!!error} aria-describedby={error ? "pin-unlock-error" : "pin-unlock-hint"}
              className={`${inputClass} font-mono text-h3 tracking-[0.4em]`}
            />
          </Field>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => finish(null)} className="flex-1">{c.cancel}</Button>
            <Button type="submit" className="flex-1">{c.submit}</Button>
          </div>
        </form>
      </Sheet>
    </Ctx.Provider>
  );
}
