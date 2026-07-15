import { LogOut } from "lucide-react";
import { Container } from "../components/Container";
import { CTAButton } from "../components/CTAButton";
import { UsersAdmin } from "../components/UsersAdmin";
import { ChangePassword } from "../components/ChangePassword";
import { VerifyBanner } from "../components/VerifyBanner";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "../router";

/** Etichetta leggibile del ruolo dell'account. */
const ROLE_LABEL: Record<string, string> = { owner: "Proprietario", editor: "Editor", viewer: "Osservatore" };

/**
 * Profilo dell'utente. Protetta da <ProtectedRoute> in SiteApp: senza login si
 * viene rimandati a /login. Mostra le info dell'account reale e permette il logout.
 */
export function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null; // la guardia reindirizza; questo è solo un fallback difensivo

  const initials = user.name.slice(0, 2).toUpperCase();

  return (
    <Container className="py-16">
      <div className="mx-auto max-w-md">
        <div className="flex flex-col items-center rounded-2xl border border-line/70 bg-ink-900/40 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/15 text-xl font-semibold text-brand ring-1 ring-inset ring-brand/30">
            {initials}
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-50">{user.name}</h1>
          <p className="mt-0.5 text-sm text-slate-400">{user.email}</p>
          <span className="mt-2 inline-flex items-center rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
            {ROLE_LABEL[user.role] ?? user.role}
          </span>

          <div className="mt-6 flex w-full flex-col gap-2.5">
            <CTAButton to="/app" variant="primary">
              Entra nella stanza
            </CTAButton>
            <button
              type="button"
              onClick={() => {
                void logout();
                navigate("/");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-ink-800/40 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-red-400/40 hover:text-red-300"
            >
              <LogOut size={15} />
              Esci
            </button>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">Sessione sul runtime SAMS — esci per chiuderla su questo dispositivo.</p>

        {/* `=== false` e non `!user.emailVerified`: il campo è opzionale, e un server che
            non lo manda (o un client più vecchio) non deve far comparire l'avviso. */}
        {user.emailVerified === false && <VerifyBanner />}

        <div className="text-center">
          <ChangePassword />
        </div>

        {user.role === "owner" && <UsersAdmin selfEmail={user.email} />}
      </div>
    </Container>
  );
}
