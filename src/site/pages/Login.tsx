import { useState, type FormEvent } from "react";
import { ArrowRight, Info } from "lucide-react";
import { Container } from "../components/Container";
import { Logo } from "../components/Logo";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "../router";

/**
 * Pagina di accesso/registrazione — auth *mock* (Roadmap 5): qualunque email valida
 * "accede" e reindirizza alla stanza. Nessuna password verificata, nessun backend;
 * l'auth reale arriverà con la Roadmap 4. Un banner lo dichiara esplicitamente.
 */
export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Inserisci un'email valida.");
      return;
    }
    login(value, mode === "signup" ? name : undefined);
    navigate("/app");
  }

  const isSignup = mode === "signup";

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

        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200/90">
          <Info size={15} className="mt-0.5 shrink-0" />
          <span>Accesso dimostrativo (mock): qualunque email valida entra. L'autenticazione reale arriverà più avanti.</span>
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
              placeholder="••••••••"
              className="rounded-lg border border-line bg-ink-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand/60"
            />
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium !text-white transition-all hover:bg-brand/90 active:scale-[0.98]"
          >
            {isSignup ? "Registrati" : "Accedi"}
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
