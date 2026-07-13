import { useEffect, useState } from "react";
import { fetchUsers, setUserRoleRemote, type ManagedUser } from "../../lib/backend";
import type { SiteRole } from "../auth/AuthContext";

const ROLES: SiteRole[] = ["viewer", "editor", "owner"];
const ROLE_LABEL: Record<SiteRole, string> = { owner: "Proprietario", editor: "Editor", viewer: "Osservatore" };

/**
 * Gestione utenti per l'owner (auth reale, frontiera #3): elenca gli account e permette
 * di cambiarne il ruolo. Rende utilizzabili i ruoli in un team — senza, dopo il primo
 * utente restano tutti viewer. Mostrata solo se il chiamante è owner (il server rifiuta
 * comunque i non-owner con 403 → l'elenco resta vuoto e la sezione non compare).
 */
export function UsersAdmin({ selfEmail }: { selfEmail: string }) {
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
              <p className="truncate text-xs text-slate-500">{u.email}</p>
            </div>
            <select
              value={u.role}
              disabled={busy === u.email || u.email === selfEmail}
              onChange={(e) => void change(u.email, e.target.value as SiteRole)}
              title={u.email === selfEmail ? "Non puoi cambiare il tuo stesso ruolo" : undefined}
              className="shrink-0 rounded-md border border-line bg-ink-900 px-2 py-1 text-xs text-slate-200 outline-none focus:border-brand/60 disabled:opacity-50"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}
