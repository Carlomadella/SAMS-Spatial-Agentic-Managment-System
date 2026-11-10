import { useEffect, useState, type FormEvent } from "react";
import { Check, Copy, KeyRound, Send, X } from "lucide-react";
import {
  createInviteRemote,
  fetchInvites,
  fetchUsers,
  issueUserResetLink,
  revokeInviteRemote,
  setUserRoleRemote,
  type InviteRole,
  type ManagedUser,
  type PendingInvite,
} from "../../lib/backend";
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
 *
 * E gli **inviti** (D3-B): l'owner scrive un'email, sceglie editor o osservatore, e la
 * persona entra già col ruolo giusto. Con un canale email l'invito parte da solo; senza,
 * il link compare qui da consegnare a mano.
 */
export function UsersAdmin({ selfEmail }: { selfEmail: string }) {
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<{ email: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("viewer");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string; link: string; emailed: boolean } | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  useEffect(() => {
    void fetchUsers().then(setUsers);
    void fetchInvites().then(setInvites);
  }, []);

  async function invite(e: FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setInviteBusy(true);
    setInviteError(null);
    setInviteCopied(false);
    const res = await createInviteRemote(email, inviteRole);
    setInviteBusy(false);
    if (res.ok && res.invite && res.link) {
      const added = res.invite;
      setInvites((list) => [added, ...list.filter((i) => i.email !== added.email)]);
      setSent({ email: added.email, link: res.link, emailed: res.emailed === true });
      setInviteEmail("");
    } else {
      setInviteError(res.error ?? "Invito non riuscito");
    }
  }

  async function revoke(id: string) {
    setInviteError(null);
    const res = await revokeInviteRemote(id);
    if (res.ok) setInvites((list) => list.filter((i) => i.id !== id));
    else setInviteError(res.error ?? "Revoca non riuscita");
  }

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

  async function copyLink(link: string, done: (ok: boolean) => void = setCopied) {
    try {
      await navigator.clipboard.writeText(link);
      done(true);
    } catch {
      done(false); // clipboard negata → il link è comunque selezionabile a mano
    }
  }

  // Niente utenti (non owner, runtime giù, o lista vuota) → non mostrare la sezione.
  if (!users || users.length === 0) return null;

  return (
    <div className="mx-auto mt-6 max-w-md rounded-2xl border border-line/70 bg-ink-900/40 p-6">
      <h2 className="text-sm font-semibold text-slate-200">Gestione utenti</h2>
      <p className="mt-1 text-xs text-slate-500">Assegna i ruoli agli account del workspace.</p>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
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
                {u.emailVerified === false && <span className="ml-1.5 text-slate-400/90">· da confermare</span>}
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

      <div className="mt-6 border-t border-line/60 pt-5">
        <h3 className="text-sm font-semibold text-slate-200">Invita qualcuno</h3>
        <p className="mt-1 text-xs text-slate-500">
          Entra già col ruolo che scegli. Il link vale una volta, solo per quell'indirizzo, per 7 giorni.
        </p>
        <form onSubmit={invite} className="mt-3 flex flex-wrap items-center gap-1.5">
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); }}
            placeholder="nome@esempio.it"
            aria-label="Email da invitare"
            className="min-w-0 flex-1 rounded-md border border-line bg-ink-950/60 px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand/60"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as InviteRole)}
            aria-label="Ruolo dell'invito"
            className="rounded-md border border-line bg-ink-900 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-brand/60"
          >
            <option value="viewer">{ROLE_LABEL.viewer}</option>
            <option value="editor">{ROLE_LABEL.editor}</option>
          </select>
          <button
            type="submit"
            disabled={inviteBusy}
            className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 text-xs font-medium text-[#fff] transition-colors hover:bg-brand/90 disabled:opacity-60"
          >
            <Send size={12} />
            Invita
          </button>
        </form>
        {inviteError && <p className="mt-2 text-xs text-rose-400">{inviteError}</p>}

        {sent && (
          <div className="mt-3 rounded-lg border border-brand/30 bg-brand/5 p-3">
            <p className="text-xs text-slate-300">
              {sent.emailed ? (
                <>Email inviata a <span className="font-medium text-slate-100">{sent.email}</span>. Se non arriva, puoi consegnare il link qui sotto.</>
              ) : (
                <>Nessun canale email configurato: consegnalo tu a <span className="font-medium text-slate-100">{sent.email}</span>, e solo a questa persona.</>
              )}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <input
                readOnly
                value={sent.link}
                aria-label="Link d'invito"
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-md border border-line bg-ink-950/60 px-2 py-1 text-xs text-slate-300 outline-none"
              />
              <button
                type="button"
                onClick={() => void copyLink(sent.link, setInviteCopied)}
                className="shrink-0 rounded-md border border-line p-1.5 text-slate-400 transition-colors hover:border-brand/40 hover:text-brand"
                aria-label="Copia il link d'invito"
              >
                {inviteCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
            </div>
          </div>
        )}

        {invites.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {invites.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-line/60 px-3 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs text-slate-300">{i.email}</p>
                  <p className="text-[11px] text-slate-500">
                    {ROLE_LABEL[i.role]} · in attesa fino al {new Date(i.expiresAt).toLocaleDateString("it-IT")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void revoke(i.id)}
                  aria-label={`Revoca l'invito per ${i.email}`}
                  title="Revoca l'invito"
                  className="shrink-0 rounded-md border border-line p-1 text-slate-500 transition-colors hover:border-rose-400/50 hover:text-rose-400"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
