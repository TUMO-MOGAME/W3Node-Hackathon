"use client";
/**
 * WalletProvider + useWallet(): the WalletApi (./types.ts) backed by Tether WDK.
 *
 * - chain mode: every wallet is a WDK self-custodial wallet. The seed phrase is generated on the device,
 *   encrypted with the user's PIN (PBKDF2 + AES-GCM, ./crypto.ts) into localStorage, and unlocked into
 *   memory for this tab only when it first needs to sign. Nothing about the seed is ever sent anywhere.
 * - mock mode: fixed demo personas (./personas.ts), fake signatures, no network.
 *
 * PIN entry: pass `requestPin` to show your own PIN sheet; the default falls back to window.prompt.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Base58, Role, WalletSession } from "../types";
import type { WalletApi } from "./types";
import { chainConfig } from "../chain/config";
import { decryptSeed, encryptSeed, assertPin } from "./crypto";
import { loadActive, loadWallets, saveActive, saveWallets, type StoredWallet } from "./store";
import { isValidSeed, newSeedPhrase, openAccount, readOnly, wdkPartialSign, wdkSign, wdkSignAndSend, type WdkAccount } from "./wdk";
import { mockSignature, personaSessions } from "./personas";
import { setActiveSigner } from "./signer";

export type PinReason = "create" | "unlock";
export type RequestPin = (reason: PinReason, label: string) => Promise<string | null>;

const defaultRequestPin: RequestPin = async (reason, label) =>
  window.prompt(reason === "create" ? `Choose a PIN (6+ digits) to protect "${label}" on this device` : `Enter the PIN for "${label}"`);

const WalletContext = createContext<WalletApi | null>(null);

export function WalletProvider({ children, requestPin = defaultRequestPin }: { children: ReactNode; requestPin?: RequestPin }) {
  const isMock = chainConfig.dataMode === "mock";
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<WalletSession[]>([]);
  const [activeAddr, setActiveAddr] = useState<Base58 | null>(null);
  const unlocked = useRef(new Map<Base58, WdkAccount>());
  const stored = useRef<StoredWallet[]>([]);
  const pinRef = useRef(requestPin);
  useEffect(() => { pinRef.current = requestPin; }, [requestPin]);

  // Initial load from localStorage (client only, after hydration so server and client HTML match).
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      if (isMock) {
        const s = personaSessions();
        setSessions(s);
        setActiveAddr(loadActive() ?? s[0]?.address ?? null);
      } else {
        stored.current = loadWallets();
        setSessions(stored.current.map((w) => ({ address: w.address, label: w.label, role: w.role, solBalance: 0, usdtBalance: 0n })));
        const a = loadActive();
        setActiveAddr(a && stored.current.some((w) => w.address === a) ? a : stored.current[0]?.address ?? null);
      }
      setReady(true);
    });
    const accounts = unlocked.current;
    return () => { alive = false; accounts.forEach((a) => a.manager.dispose()); accounts.clear(); };
  }, [isMock]);

  const refreshBalances = useCallback(async () => {
    if (isMock) return;
    const mint = chainConfig.usdtMint;
    const updated = await Promise.all(stored.current.map(async (w) => {
      try {
        const acc = unlocked.current.get(w.address)?.account ?? (await readOnly(w.address, chainConfig.rpcUrl));
        const [lamports, usdt] = await Promise.all([acc.getBalance(), mint ? acc.getTokenBalance(mint) : Promise.resolve(0n)]);
        return { address: w.address, label: w.label, role: w.role, solBalance: Number(lamports) / 1e9, usdtBalance: usdt };
      } catch {
        return { address: w.address, label: w.label, role: w.role, solBalance: 0, usdtBalance: 0n };
      }
    }));
    setSessions(updated);
  }, [isMock]);

  useEffect(() => { if (ready) void refreshBalances(); }, [ready, refreshBalances]);

  const persist = (list: StoredWallet[]) => { stored.current = list; saveWallets(list); };

  const addWallet = useCallback(async (label: string, role: Role, seedPhrase: string): Promise<WalletSession> => {
    const acc = await openAccount(seedPhrase, chainConfig.rpcUrl);
    const session: WalletSession = { address: acc.address, label, role, solBalance: 0, usdtBalance: 0n };
    if (isMock) {
      unlocked.current.set(acc.address, acc);
    } else {
      const pin = await pinRef.current("create", label);
      if (!pin) { acc.manager.dispose(); throw new Error("A PIN is needed to keep the wallet safe on this device."); }
      assertPin(pin);
      const enc = await encryptSeed(seedPhrase, pin);
      persist([...stored.current.filter((w) => w.address !== acc.address), { address: acc.address, label, role, enc, createdAt: Date.now() }]);
      unlocked.current.set(acc.address, acc);
    }
    setSessions((prev) => [...prev.filter((s) => s.address !== acc.address), session]);
    setActiveAddr(acc.address);
    saveActive(acc.address);
    return session;
  }, [isMock]);

  const create = useCallback(async (label: string, role: Role) => {
    const seedPhrase = await newSeedPhrase();
    const session = await addWallet(label, role, seedPhrase);
    return { session, seedPhrase };
  }, [addWallet]);

  const importSeed = useCallback(async (label: string, role: Role, seedPhrase: string) => {
    if (!(await isValidSeed(seedPhrase))) throw new Error("That is not a valid 12 or 24-word recovery phrase.");
    return addWallet(label, role, seedPhrase);
  }, [addWallet]);

  const switchTo = useCallback((address: Base58) => { setActiveAddr(address); saveActive(address); }, []);

  const remove = useCallback((address: Base58) => {
    unlocked.current.get(address)?.manager.dispose();
    unlocked.current.delete(address);
    if (!isMock) persist(stored.current.filter((w) => w.address !== address));
    setSessions((prev) => prev.filter((s) => s.address !== address));
    setActiveAddr((cur) => (cur === address ? null : cur));
  }, [isMock]);

  const unlock = useCallback(async (address: Base58): Promise<WdkAccount> => {
    const hit = unlocked.current.get(address);
    if (hit) return hit;
    const w = stored.current.find((x) => x.address === address);
    if (!w) throw new Error("This wallet is not stored on this device.");
    const pin = await pinRef.current("unlock", w.label);
    if (!pin) throw new Error("Signing cancelled.");
    const acc = await openAccount(await decryptSeed(w.enc, pin), chainConfig.rpcUrl);
    if (acc.address !== address) { acc.manager.dispose(); throw new Error("Stored wallet does not match its address."); }
    unlocked.current.set(address, acc);
    return acc;
  }, []);

  const signAndSendAs = useCallback(async (address: Base58, base64Tx: string): Promise<string> => {
    if (isMock) return mockSignature();
    const acc = await unlock(address);
    return wdkSignAndSend(acc.account, base64Tx);
  }, [isMock, unlock]);

  const signOnlyAs = useCallback(async (address: Base58, base64Tx: string) => {
    if (isMock) { const signature = mockSignature(); return { signature, wireBase64: "" }; }
    const acc = await unlock(address);
    return wdkSign(acc.account, base64Tx);
  }, [isMock, unlock]);

  const signPartialAs = useCallback(async (address: Base58, base64Tx: string) => {
    if (isMock) { const signature = mockSignature(); return { signature, wireBase64: "" }; }
    const acc = await unlock(address);
    return wdkPartialSign(acc.account, base64Tx);
  }, [isMock, unlock]);

  const signAndSend = useCallback(async (base64Tx: string) => {
    if (!activeAddr) throw new Error("No wallet is active. Create or choose a wallet first.");
    return signAndSendAs(activeAddr, base64Tx);
  }, [activeAddr, signAndSendAs]);

  // Keep the non-React signer (used by service/chain.ts) in step with the active wallet.
  useEffect(() => {
    setActiveSigner(activeAddr ? {
      address: activeAddr,
      signAndSend: (tx) => signAndSendAs(activeAddr, tx),
      signOnly: (tx) => signOnlyAs(activeAddr, tx),
      signPartial: (tx) => signPartialAs(activeAddr, tx),
    } : null);
  }, [activeAddr, signAndSendAs, signOnlyAs, signPartialAs]);

  const session = sessions.find((s) => s.address === activeAddr) ?? null;
  const api = useMemo<WalletApi>(() => ({
    ready, session, sessions, create, importSeed, switchTo, remove, refreshBalances, signAndSend,
  }), [ready, session, sessions, create, importSeed, switchTo, remove, refreshBalances, signAndSend]);

  return <WalletContext.Provider value={api}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletApi {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet() must be used inside <WalletProvider>.");
  return ctx;
}
