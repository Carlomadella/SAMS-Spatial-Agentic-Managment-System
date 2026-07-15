import { useState } from "react";
import { MailWarning } from "lucide-react";
import { resendVerificationRemote } from "../../lib/backend";

/**
 * Avviso "indirizzo da confermare" col rinvio del link (gestione password, 2026-07-15).
 * Si monta solo per chi ha una sessione **e** un indirizzo non ancora verificato — una
 * combinazione che esiste unicamente quando il canale email è stato acceso dopo che
 * l'account era già dentro. Chi non l'ha configurato non vede mai questo banner.
 */
export function VerifyBanner() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function resend() {
    setBusy(true);
    setMsg(null);
    const res = await resendVerificationRemote();
    setBusy(false);
    setMsg(
      res.ok
        ? { ok: true, text: "Link inviato: controlla la tua casella (anche lo spam)." }
        : { ok: false, text: res.error ?? "Invio non riuscito." },
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
      <p className="flex items-start gap-2 text-xs text-amber-200">
        <MailWarning size={15} className="mt-px shrink-0" />
        <span>Il tuo indirizzo email non è ancora confermato.</span>
      </p>
      <button
        type="button"
        onClick={() => void resend()}
        disabled={busy}
        className="mt-2 rounded-lg border border-amber-400/40 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-400/10 disabled:opacity-60"
      >
        {busy ? "Invio…" : "Rimanda il link"}
      </button>
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
    </div>
  );
}
