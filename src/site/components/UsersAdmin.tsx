import { useEffect, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { fetchUsers, issueUserResetLink, setUserRoleRemote, type ManagedUser } from "../../lib/backend";
import type { SiteRole } from "../auth/AuthContext";

const ROLES: SiteRole[] = ["viewer", "editor", "owner"];
const ROLE_LABEL: Record<SiteRole, string> = { owner: "Proprietario", editor: "Editor", viewer: "Osservatore" };

/**
 * Gestione utenti per l'owner (auth reale, frontiera #3): elenca gli account e permette
 * di cambiarne il ruolo. Rende utilizzabili i ruoli in un team — senza, dopo il primo
 * utente restano tutti viewer. Mostrata solo se il chiamante è owner (il server rifiuta
 * comunque i non-owner con 403 → l'elenco resta vuoto e la sezione non compare).
 *
 * Ospita anche il **reset owner-issued** (gestione password, 2026-07-15): l'owner genera
 * un link monouso e lo consegna a mano. È la via di rientro quando SAMS gira senza canale
 * email — senza, un utente chiuso fuori richiederebbe un intervento a mano sul DB.
 */
export function UsersAdmin({ selfEmail }: { selfEmail: string }) {
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<{ email: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void fetchUsers().then(setUsers);
  }, []);

  async function change(email: string, role: SiteRole) {
    setBusy(email);
    setError(null);
    const res = await setUserRoleRemote(email, role);
    setBusy(null);
    if (res.ok) {
      setUsers((us) => us?.map((u) => (u.email === email ? { ...u, role } : u)) ?? null);
    } else {
      setError(res.error ?? "Aggiornamento non riuscito");
      void fetchUsers().then(setUsers); // ripristina lo stato reale
    }
  }

  async function issueReset(email: string) {
    setBusy(email);
    setError(null);
    setCopied(false);
    const res = await issueUserResetLink(email);
    setBusy(null);
    if (res.ok && res.link) setResetFor({ email, link: res.link });
    else setError(res.error ?? "Emissione del link non riuscita");
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false); // clipboard negata → il link è comunque selezionabile a mano
    }
  }

  // Niente utenti (non owner, runtime giù, o lista vuota) → non mostrare la sezione.
  if (!users || users.length === 0) return null;

  return (
    <div className="mx-auto mt-6 max-w-md rounded-2xl border border-line/70 bg-ink-900/40 p-6">
      <h2 className="text-sm font-semibold text-slate-200">Gestione utenti</h2>
      <p className="mt-1 text-xs text-slate-500">Assegna i ruoli agli account del workspace.</p>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <ul className="mt-4 flex flex-col gap-2">
        {users.map((u) => (
          <li
            key={u.email}
            className="flex items-center justify-between gap-3 rounded-lg border border-line/60 bg-ink-950/40 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-slate-200">{u.name}</p>
              <p className="truncate text-xs text-slate-500">
                {u.email}
                {u.emailVerified === false && <span className="ml-1.5 text-amber-400/90">· da confermare</span>}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => void issueReset(u.email)}
                disabled={busy === u.email}
                title="Genera un link di reset password da consegnare a questa persona"
                aria-label={`Genera un link di reset per ${u.email}`}
                className="rounded-md border border-line p-1.5 text-slate-400 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
              >
                <KeyRound size={13} />
              </button>
              <select
                value={u.role}
                disabled={busy === u.email || u.email === selfEmail}
                onChange={(e) => void change(u.email, e.target.value as SiteRole)}
                title={u.email === selfEmail ? "Non puoi cambiare il tuo stesso ruolo" : undefined}
                className="rounded-md border border-line bg-ink-900 px-2 py-1 text-xs text-slate-200 outline-none focus:border-brand/60 disabled:opacity-50"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          </li>
        ))}
      </ul>

      {resetFor && (
        <div className="mt-4 rounded-lg border border-brand/30 bg-brand/5 p-3">
          <p className="text-xs text-slate-300">
            Link di reset per <span className="font-medium text-slate-100">{resetFor.email}</span> — monouso, scade tra
            un'ora. Consegnalo solo a questa persona.
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <input
              readOnly
              value={resetFor.link}
              aria-label="Link di reset"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-line bg-ink-950/60 px-2 py-1 text-xs text-slate-300 outline-none"
            />
            <button
              type="button"
              onClick={() => void copyLink(resetFor.link)}
              className="shrink-0 rounded-md border border-line p-1.5 text-slate-400 transition-colors hover:border-brand/40 hover:text-brand"
              aria-label="Copia il link"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => { setResetFor(null); setCopied(false); }}
            className="mt-2 text-xs text-slate-500 transition-colors hover:text-slate-300"
          >
            Chiudi
          </button>
        </div>
      )}
    </div>
  );
}
