import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Container } from "../components/Container";
import { Logo } from "../components/Logo";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "../router";

/**
 * Pagina di accesso/registrazione — auth **reale** (Roadmap 4): account veri sul
 * runtime (email+password, hashing scrypt, sessione via bearer token). Su successo
 * reindirizza alla stanza. Il primo account registrato diventa owner.
 */
export function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Inserisci un'email valida.");
      return;
    }
    if (password.length < 8) {
      setError("La password deve avere almeno 8 caratteri.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = isSignup ? await register(value, password, name.trim() || undefined) : await login(value, password);
    setBusy(false);
    if (res.ok) {
      navigate("/app");
    } else {
      setError(res.error ?? "Operazione non riuscita.");
    }
  }

  return (
    <Container className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-50">
            {isSignup ? "Crea il tuo account" : "Bentornato"}
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            {isSignup ? "Registrati per entrare nella stanza." : "Accedi per entrare nella stanza."}
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-ink-900/40 p-6">
          {isSignup && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-400">Nome</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                className="rounded-lg border border-line bg-ink-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand/60"
              />
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-400">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="tu@esempio.com"
              className="rounded-lg border border-line bg-ink-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand/60"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-400">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="••••••••"
              autoComplete={isSignup ? "new-password" : "current-password"}
              className="rounded-lg border border-line bg-ink-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand/60"
            />
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium !text-white transition-all hover:bg-brand/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Attendere…" : isSignup ? "Registrati" : "Accedi"}
            <ArrowRight size={16} />
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-400">
          {isSignup ? "Hai già un account?" : "Non hai un account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(isSignup ? "login" : "signup");
              setError(null);
            }}
            className="font-medium text-brand hover:underline"
          >
            {isSignup ? "Accedi" : "Registrati"}
          </button>
        </p>
      </div>
    </Container>
  );
}
