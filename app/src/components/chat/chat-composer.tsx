"use client";
/**
 * The chat composer: a large rounded box pinned to the bottom of the chat home. Type (Enter sends,
 * Shift+Enter adds a line), dictate, start a voice call, attach a document for the agent to read, or
 * start a payment request (which always ends in the payment review, never a silent send).
 */
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ChangeEvent, type FormEvent } from "react";
import clsx from "clsx";
import { ArrowUp, FileText, Mic, Paperclip, Phone, Send, Square, X } from "lucide-react";
import type { ChatAttachment } from "@/lib/chat/types";
import { useEstate } from "@/lib/hooks/estate";
import { fmt, useCopy } from "@/components/shell/copy";

type Purpose = NonNullable<ChatAttachment["purpose"]>;
const PURPOSES: Purpose[] = ["general", "death", "claim", "hardship"];
const MAX_FILE = 8 * 1024 * 1024;

/* Speech recognition is not in TypeScript's DOM types yet; this is the part we use. */
interface Recognition {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type RecognitionCtor = new () => Recognition;
const recognitionCtor = (): RecognitionCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};
const noop = () => () => undefined;

const tool = "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-line-strong bg-surface text-small font-medium text-ink transition-colors hover:bg-surface-2 disabled:opacity-50";

export function ChatComposer({ onSend, disabled }: { onSend: (text: string, opts?: { attachment?: File; purpose?: Purpose }) => void; disabled?: boolean }) {
  const { assistant } = useCopy();
  const c = assistant.home.composer;
  const { openAgent, notify } = useEstate();
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [purpose, setPurpose] = useState<Purpose>("general");
  const [listening, setListening] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const rec = useRef<Recognition | null>(null);
  const fieldId = useId();
  const canDictate = useSyncExternalStore(noop, () => !!recognitionCtor(), () => false);

  useEffect(() => () => rec.current?.abort(), []);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (disabled || (!value.trim() && !file)) return;
    rec.current?.stop();
    onSend(value.trim() || (file ? c.defaultMessage[purpose] : ""), file ? { attachment: file, purpose } : undefined);
    setValue("");
    setFile(null);
    setPurpose("general");
    field.current?.focus();
  };

  const choose = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    e.target.value = ""; // so the same file can be picked again
    if (!f) return;
    if (f.type !== "application/pdf" && !f.type.startsWith("image/") && !/\.(pdf|png|jpe?g|webp|heic)$/i.test(f.name)) { notify("error", c.fileType); return; }
    if (f.size > MAX_FILE) { notify("error", c.fileTooBig); return; }
    setFile(f);
    field.current?.focus();
  };

  const dictate = () => {
    if (listening) { rec.current?.stop(); return; }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    const base = value.trim() ? `${value.trim()} ` : "";
    r.lang = document.documentElement.lang || "en-ZA";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (ev) => setValue(base + Array.from(ev.results).map((x) => x[0]?.transcript ?? "").join(""));
    r.onerror = (ev) => { if (ev.error !== "aborted" && ev.error !== "no-speech") notify("error", c.dictateError); };
    r.onend = () => { setListening(false); rec.current = null; field.current?.focus(); };
    rec.current = r;
    try { r.start(); setListening(true); } catch { rec.current = null; notify("error", c.dictateError); }
  };

  const draftPayment = () => {
    setValue((v) => (v.trim() ? v : c.sendMoneyDraft));
    const el = field.current;
    if (el) { el.focus(); window.requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length)); }
  };

  return (
    <form onSubmit={submit} className="rounded-[1.75rem] border border-ink bg-surface p-2 shadow-raised focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]">
      {file && (
        <div className="mb-1 rounded-[1.25rem] border border-line-strong p-2.5">
          <div className="flex items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-bg"><FileText className="size-4" aria-hidden="true" /></span>
            <p className="min-w-0 flex-1 truncate text-small font-semibold" role="status">{fmt(assistant.home.attachment, { name: file.name })}</p>
            <button type="button" onClick={() => setFile(null)} aria-label={fmt(c.removeFile, { name: file.name })} className="grid size-11 shrink-0 place-items-center rounded-full text-ink hover:bg-surface-2">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <fieldset className="mt-1.5">
            <legend className="mb-1.5 text-[0.75rem] font-semibold text-ink-2">{c.purposeLabel}</legend>
            <div className="flex flex-wrap gap-1.5">
              {PURPOSES.map((p) => (
                <label key={p} className={clsx("flex min-h-11 cursor-pointer items-center rounded-full border px-3.5 text-small font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]", purpose === p ? "border-ink bg-ink text-bg" : "border-line-strong bg-surface hover:bg-surface-2")}>
                  <input type="radio" name={`${fieldId}-purpose`} value={p} checked={purpose === p} onChange={() => setPurpose(p)} className="sr-only" />
                  {c.purposes[p]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      <div className="flex items-end gap-2 pl-3">
        <label htmlFor={fieldId} className="sr-only">{assistant.chat.inputLabel}</label>
        <textarea
          id={fieldId} ref={field} rows={1} value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
          placeholder={c.placeholder}
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-body outline-none placeholder:text-ink-2 [field-sizing:content]"
        />
        <button type="submit" disabled={disabled || (!value.trim() && !file)} aria-label={assistant.chat.send} className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-bg transition-opacity disabled:opacity-40">
          <ArrowUp className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div role="group" aria-label={c.toolsLabel} className="mt-1 flex flex-wrap items-center gap-1.5">
        {canDictate && (
          <button type="button" onClick={dictate} aria-pressed={listening} aria-label={listening ? c.dictateStop : c.dictate} title={listening ? c.dictateStop : c.dictate} className={clsx(tool, "w-11", listening && "border-ink bg-ink text-bg hover:bg-ink")}>
            {listening ? <Square className="size-4 animate-pulse-soft" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}
          </button>
        )}
        <button type="button" onClick={() => openAgent("call")} aria-label={c.call} title={c.call} className={clsx(tool, "w-11")}>
          <Phone className="size-5" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => picker.current?.click()} disabled={disabled} className={clsx(tool, "px-3.5")}>
          <Paperclip className="size-4" aria-hidden="true" />{c.attach}
        </button>
        <button type="button" onClick={draftPayment} className={clsx(tool, "px-3.5 max-[399px]:hidden")}>
          <Send className="size-4" aria-hidden="true" />{c.sendMoney}
        </button>
        <input ref={picker} type="file" accept="application/pdf,image/*" tabIndex={-1} aria-hidden="true" className="sr-only" onChange={choose} />
        <span className="sr-only" role="status">{listening ? c.dictating : ""}</span>
      </div>
    </form>
  );
}
