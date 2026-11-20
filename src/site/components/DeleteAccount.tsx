import { useState, type FormEvent } from "react";
import { deleteAccountRemote } from "../../lib/backend";
import { useAuth } from "../auth/AuthContext";
import { Link, useNavigate } from "../router";

/**
 * «Elimina account» (pagina Privacy, 20/11/2026 — diritto alla cancellazione del GDPR).
 * Spiega cosa sparisce e cosa resta al workspace, chiede la password e una conferma
 * esplicita; a buon fine chiude la sessione locale e torna alla home.
 */
export function DeleteAccount() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!confirmed || !password) return;
    setBusy(true);
    setError(null);
    const res = await deleteAccountRemote(password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Eliminazione non riuscita.");
      return;
    }
    await logout();
    navigate("/");
  }

  function close() {
    setOpen(false);
    setPassword("");
    setConfirmed(false);
    setError(null);
  }

  return (
    <div className="mx-auto mt-4 max-w-md text-center">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-slate-500 transition-colors hover:text-rose-300"
        >
          Elimina account
        </button>
      ) : (
        <form
          onSubmit={submit}
          aria-label="Elimina account"
          className="flex flex-col gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/5 p-5 text-left"
        >
          <span className="text-sm font-semibold text-rose-200">Elimina account</span>
          <p className="text-xs leading-relaxed text-slate-400">
            Cancella subito e per sempre il tuo account, le sessioni aperte, il collegamento a GitHub e gli inviti in
            sospeso. Agenti, task e chat appartengono al workspace e restano. Dettagli nell&apos;
            <Link to="/privacy" className="text-brand hover:underline">informativa sulla privacy</Link>.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password attuale"
            aria-label="Password attuale"
            autoComplete="current-password"
            className="rounded-lg border border-line bg-ink-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-rose-400/60"
          />
          <label className="flex items-start gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
            Ho capito: l&apos;eliminazione non si può annullare.
          </label>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="submit"
              disabled={busy || !confirmed || !password}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-[#fff] transition-colors hover:bg-rose-500 disabled:opacity-50"
            >
              {busy ? "Elimino…" : "Elimina definitivamente"}
            </button>
            <button type="button" onClick={close} className="rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:text-slate-200">
              Annulla
            </button>
          </div>
          {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
        </form>
      )}
    </div>
  );
}
