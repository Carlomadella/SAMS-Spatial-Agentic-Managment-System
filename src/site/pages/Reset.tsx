import { useState, type FormEvent } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { Container } from "../components/Container";
import { Logo } from "../components/Logo";
import { resetPasswordRemote } from "../../lib/backend";
import { useLocation, useNavigate } from "../router";

/**
 * Pagina di reset password (gestione password, doc di decisione 2026-07-15). È la via di
 * rientro per chi è chiuso fuori: si arriva qui dal link monouso — spedito via email se
 * il canale è configurato, altrimenti emesso dall'owner dalla UsersAdmin e consegnato a
 * mano. Il token viaggia nella query string (`/reset?token=…`); niente sessione, è proprio
 * il punto (chi non ricorda la password non può averne una).
 */
export function Reset() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const token = new URLSearchParams(search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== confirm) {
      setError("Le due password non coincidono.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await resetPasswordRemote(token, password);
    setBusy(false);
    if (res.ok) setDone(true);
    else setError(res.error ?? "Reset non riuscito.");
  }

  // Nessun token nell'URL → non c'è niente da fare qui: si riparte da "password dimenticata".
  if (!token) {
    return (
      <Container className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
        <div className="w-full max-w-sm text-center">
          <Logo />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-50">Link non valido</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Questo indirizzo non contiene un codice di reset. Richiedi un nuovo link dalla pagina di accesso.
          </p>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-[#fff] transition-all hover:bg-brand/90"
          >
            Vai all'accesso
            <ArrowRight size={16} />
          </button>
        </div>
      </Container>
    );
  }

  if (done) {
    return (
      <Container className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
        <div className="w-full max-w-sm text-center">
          <Logo />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-50">Password aggiornata</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Ora puoi accedere con la nuova password. Gli altri dispositivi sono stati sloggati.
          </p>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-[#fff] transition-all hover:bg-brand/90"
          >
            Accedi
            <ArrowRight size={16} />
          </button>
        </div>
      </Container>
    );
  }

  return (
    <Container className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo />
          <h1 className="mt-5 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-50">
            <KeyRound size={20} className="text-brand" />
            Nuova password
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">Scegli una password nuova per il tuo account.</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-ink-900/40 p-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-400">Nuova password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder="••••••••"
              autoComplete="new-password"
              className="rounded-lg border border-line bg-ink-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand/60"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-400">Conferma password</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(null); }}
              placeholder="••••••••"
              autoComplete="new-password"
              className="rounded-lg border border-line bg-ink-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand/60"
            />
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-[#fff] transition-all hover:bg-brand/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Attendere…" : "Imposta la password"}
            <ArrowRight size={16} />
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">Il link è monouso e scade un'ora dopo la richiesta.</p>
      </div>
    </Container>
  );
}
