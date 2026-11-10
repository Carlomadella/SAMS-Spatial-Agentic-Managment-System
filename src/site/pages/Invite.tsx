import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, MailOpen } from "lucide-react";
import { Container } from "../components/Container";
import { Logo } from "../components/Logo";
import { lookupInviteRemote, type InviteRole } from "../../lib/backend";
import { useAuth } from "../auth/AuthContext";
import { useLocation, useNavigate } from "../router";

const ROLE_LABEL: Record<InviteRole, string> = { editor: "Editor", viewer: "Osservatore" };
const ROLE_HINT: Record<InviteRole, string> = {
  editor: "potrai assegnare e approvare lavoro, usare la Live Sim e la chat",
  viewer: "potrai guardare il workspace e seguire il lavoro degli agenti",
};

const INPUT =
  "rounded-lg border border-line bg-ink-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand/60";
const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-[#fff] transition-all hover:bg-brand/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Pagina d'invito (D3-B). Si arriva qui dal link che l'owner ha mandato per email o
 * consegnato a mano (`/invito?token=…`). Il server dice per chi è l'invito: l'email è
 * fissata (l'invito vale solo per quell'indirizzo) e il ruolo è quello scelto dall'owner.
 * Pubblica di proposito: chi è invitato non ha ancora un account.
 */
export function Invite() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const { register } = useAuth();
  const token = new URLSearchParams(search).get("token") ?? "";
  const [invite, setInvite] = useState<{ email: string; role: InviteRole } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    void lookupInviteRemote(token).then((res) => {
      if (!alive) return;
      if (res.ok && res.email && res.role) setInvite({ email: res.email, role: res.role });
      else setLookupError(res.error ?? "Invito non valido");
    });
    return () => {
      alive = false;
    };
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!invite) return;
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
    const res = await register(invite.email, password, name.trim() || undefined, token);
    setBusy(false);
    if (res.ok) navigate("/app");
    else setError(res.error ?? "Registrazione non riuscita.");
  }

  if (!token || lookupError) {
    return (
      <Container className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
        <div className="w-full max-w-sm text-center">
          <Logo />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-50">
            {token ? "Invito non utilizzabile" : "Link non valido"}
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            {lookupError ?? "Questo indirizzo non contiene un invito. Chiedi un nuovo link a chi ti ha invitato."}
          </p>
          <button type="button" onClick={() => navigate("/login")} className={`mt-6 ${PRIMARY}`}>
            Vai all'accesso
            <ArrowRight size={16} />
          </button>
        </div>
      </Container>
    );
  }

  if (!invite) {
    return (
      <Container className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
        <p className="text-sm text-slate-400">Controllo l'invito…</p>
      </Container>
    );
  }

  return (
    <Container className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo />
          <h1 className="mt-5 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-50">
            <MailOpen size={20} className="text-brand" />
            Sei invitato
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Entri nel workspace come <span className="font-medium text-slate-200">{ROLE_LABEL[invite.role]}</span>:{" "}
            {ROLE_HINT[invite.role]}.
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-ink-900/40 p-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-400">Email</span>
            <input type="email" value={invite.email} readOnly className={`${INPUT} cursor-not-allowed text-slate-400`} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-400">Nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Come ti vedranno gli altri"
              autoComplete="name"
              className={INPUT}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-400">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder="••••••••"
              autoComplete="new-password"
              className={INPUT}
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
              className={INPUT}
            />
          </label>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <button type="submit" disabled={busy} className={`mt-1 ${PRIMARY}`}>
            {busy ? "Attendere…" : "Crea l'account"}
            <ArrowRight size={16} />
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">L'invito vale una volta sola e solo per questo indirizzo.</p>
      </div>
    </Container>
  );
}
