import { Check } from "lucide-react";

/** Lunghezza minima della password: la stessa regola del server (`MIN_PASSWORD` in server/src/auth.ts). */
export const MIN_PASSWORD = 8;

/**
 * Il requisito della password, visibile *prima* di inviare il modulo (collaudo 20/11:
 * si scopriva solo dall'errore). Si aggiorna mentre si scrive.
 */
export function PasswordHint({ id, value }: { id: string; value: string }) {
  const ok = value.length >= MIN_PASSWORD;
  return (
    <span id={id} className={`flex items-center gap-1 text-[11px] ${ok ? "text-emerald-400" : "text-slate-500"}`}>
      {ok && <Check size={11} aria-hidden />}
      Almeno {MIN_PASSWORD} caratteri
      {value.length > 0 && !ok && <span className="tabular-nums"> · {value.length}/{MIN_PASSWORD}</span>}
    </span>
  );
}
