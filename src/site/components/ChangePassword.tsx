import { useState, type FormEvent } from "react";
import { changePasswordRemote } from "../../lib/backend";

/**
 * Cambio password del proprio account (auth reale, frontiera #3). Verifica la password
 * attuale e ne imposta una nuova (min 8 caratteri); il server slogga gli altri dispositivi.
 * Niente reset via email — solo cambio da loggati.
 */
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setMsg({ ok: false, text: "La nuova password deve avere almeno 8 caratteri." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await changePasswordRemote(oldPassword, newPassword);
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Password aggiornata." });
      setOld("");
      setNew("");
      setOpen(false);
    } else {
      setMsg({ ok: false, text: res.error ?? "Cambio password non riuscito." });
    }
  }

  return (
    <div className="mx-auto mt-4 max-w-md">
      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setMsg(null); }}
          className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
        >
          Cambia password
        </button>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-2 rounded-2xl border border-line/70 bg-ink-900/40 p-5">
          <span className="text-sm font-semibold text-slate-200">Cambia password</span>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOld(e.target.value)}
            placeholder="Password attuale"
            autoComplete="current-password"
            className="rounded-lg border border-line bg-ink-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand/60"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            placeholder="Nuova password (min 8)"
            autoComplete="new-password"
            className="rounded-lg border border-line bg-ink-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand/60"
          />
          <div className="mt-1 flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium !text-white transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              {busy ? "Salvo…" : "Salva"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setMsg(null); }}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:text-slate-200"
            >
              Annulla
            </button>
          </div>
        </form>
      )}
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
    </div>
  );
}
