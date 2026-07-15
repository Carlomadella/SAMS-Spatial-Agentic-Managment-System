import { useEffect, useRef, useState } from "react";
import { ArrowRight, MailCheck, MailX } from "lucide-react";
import { Container } from "../components/Container";
import { Logo } from "../components/Logo";
import { verifyEmailRemote } from "../../lib/backend";
import { useAuth } from "../auth/AuthContext";
import { useLocation, useNavigate } from "../router";

type State = { kind: "working" } | { kind: "ok" } | { kind: "error"; message: string };

/**
 * Pagina di conferma dell'indirizzo email (gestione password, doc di decisione 2026-07-15).
 * Si arriva qui dal link spedito alla registrazione: la conferma parte da sola al mount,
 * senza far cliccare un altro bottone — il click sul link **era** l'intenzione.
 */
export function Verify() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const token = new URLSearchParams(search).get("token") ?? "";
  const [state, setState] = useState<State>(() =>
    token ? { kind: "working" } : { kind: "error", message: "Questo indirizzo non contiene un codice di verifica." },
  );
  // React 18 in StrictMode monta due volte in dev: senza guardia la seconda chiamata
  // spenderebbe un token già speso e mostrerebbe un errore su una verifica riuscita.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    let alive = true;
    void verifyEmailRemote(token).then(async (res) => {
      if (!alive) return;
      if (res.ok) {
        setState({ kind: "ok" });
        await refresh(); // se c'è una sessione, il badge "da confermare" sparisce subito
      } else {
        setState({ kind: "error", message: res.error ?? "Verifica non riuscita." });
      }
    });
    return () => {
      alive = false;
    };
  }, [token, refresh]);

  return (
    <Container className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
      <div className="w-full max-w-sm text-center">
        <Logo />

        {state.kind === "working" && (
          <>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-50">Sto confermando…</h1>
            <p className="mt-1.5 text-sm text-slate-400">Un istante.</p>
          </>
        )}

        {state.kind === "ok" && (
          <>
            <h1 className="mt-5 flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight text-slate-50">
              <MailCheck size={22} className="text-emerald-400" />
              Indirizzo confermato
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">Il tuo account è attivo: ora puoi accedere.</p>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-[#fff] transition-all hover:bg-brand/90"
            >
              Accedi
              <ArrowRight size={16} />
            </button>
          </>
        )}

        {state.kind === "error" && (
          <>
            <h1 className="mt-5 flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight text-slate-50">
              <MailX size={22} className="text-red-400" />
              Non ha funzionato
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">{state.message}</p>
            <p className="mt-3 text-xs text-slate-500">
              Se il link è scaduto, accedi e chiedine uno nuovo dal tuo profilo.
            </p>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-[#fff] transition-all hover:bg-brand/90"
            >
              Vai all'accesso
              <ArrowRight size={16} />
            </button>
          </>
        )}
      </div>
    </Container>
  );
}
