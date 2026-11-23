import { useState } from "react";
import { Check, Copy, FileText } from "lucide-react";
import type { TaskResult } from "../types";

/** Oltre questa lunghezza il risultato parte chiuso, con «Mostra tutto». */
const PREVIEW_CHARS = 600;

function fmtWhen(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * Il risultato completo dell'ultimo task (collaudo 21/11, punto 1): la proposta di un task
 * di sola lettura prima si leggeva solo tagliata a una riga nel Log eventi.
 */
export function TaskResultBox({ result }: { result: TaskResult }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const long = result.summary.length > PREVIEW_CHARS;
  const text = long && !open ? `${result.summary.slice(0, PREVIEW_CHARS).trimEnd()}…` : result.summary;

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* appunti non disponibili: il testo resta selezionabile */
    }
  }

  return (
    <section aria-label="Risultato dell'ultimo task" className="mt-3 rounded-lg border border-line bg-ink-850/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
          <FileText size={12} /> Risultato
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-mut hover:bg-ink-700 hover:text-slate-200"
        >
          {copied ? <Check size={10} /> : <Copy size={10} />} {copied ? "Copiato" : "Copia"}
        </button>
      </div>
      <p className="mt-1 truncate text-[10px] text-mut" title={result.title}>
        {result.title} · {fmtWhen(result.ts)}
      </p>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-[11.5px] leading-relaxed text-slate-200">{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-[10px] text-brand-soft hover:underline">
          {open ? "Mostra meno" : "Mostra tutto"}
        </button>
      )}
    </section>
  );
}
