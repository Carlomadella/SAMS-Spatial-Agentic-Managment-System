import { useEffect, useState } from "react";
import { Activity, Loader2, RefreshCw, Sprout } from "lucide-react";
import { fetchPublicSnapshot, type PublicSnapshot } from "../lib/backend";

const STAGE_EMOJI: Record<string, string> = {
  seed: "🌰", sprout: "🌱", sapling: "🌿", bush: "🪴", tree: "🌳", blooming: "🌸",
};

function fmtUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/**
 * Dashboard pubblica read-only — una vista condivisibile dello stato del mondo
 * (runtime, metriche, giardini) senza poter assegnare task. Mostrata quando
 * l'URL contiene `?public` (con `&token=…` se il runtime richiede il token di
 * sola lettura). Fa polling di `/api/public`; nessuna azione mutante.
 */
export function PublicDashboard() {
  const [snap, setSnap] = useState<PublicSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const token = new URLSearchParams(window.location.search).get("token") ?? undefined;

  async function load() {
    setLoading(true);
    const s = await fetchPublicSnapshot(token);
    setSnap(s);
    setError(s === null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen w-screen overflow-y-auto bg-ink-950 text-slate-200">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-[20px] font-bold text-white">
              <Activity size={20} className="text-brand-soft" /> SAMS · dashboard pubblica
            </h1>
            <p className="mt-1 text-[12px] text-mut">
              Sola lettura — lo stato del mondo condiviso, senza controlli.
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-[12px] text-slate-200 hover:bg-ink-700 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Aggiorna
          </button>
        </header>

        {loading && !snap ? (
          <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-mut">
            <Loader2 size={16} className="animate-spin" /> Carico lo stato…
          </div>
        ) : error || !snap ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-6 text-center text-[13px] text-rose-200">
            Runtime non raggiungibile o token di sola lettura non valido.
          </div>
        ) : (
          <div className="space-y-5">
            {/* runtime */}
            <section className="rounded-2xl border border-line/60 bg-ink-900/60 p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${snap.runtime.ready ? "bg-emerald-400" : "bg-amber-400"}`} />
                <span className="text-[13px] font-semibold text-slate-100">
                  {snap.runtime.ready ? "Runtime attivo" : "Runtime in configurazione"}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-3">
                {[
                  ["Provider", snap.runtime.provider],
                  ["Modello", snap.runtime.model],
                  ["Repo", snap.runtime.repo],
                  ["Branch base", snap.runtime.baseBranch],
                  ["Uptime", fmtUptime(snap.metrics.uptimeSec)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[10px] uppercase tracking-wide text-mut">{k}</dt>
                    <dd className="truncate font-medium text-slate-200" title={String(v)}>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* metriche */}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [snap.metrics.lifetimeCompleted, "task completati", "totali"],
                [snap.metrics.tasksStarted, "task avviati", "da avvio"],
                [snap.metrics.errors, "errori", "da avvio"],
                [fmtTokens(snap.metrics.lifetimeTokens), "token", "totali"],
              ].map(([v, l, sub]) => (
                <div key={l} className="rounded-xl border border-line/60 bg-ink-900/60 p-4 text-center">
                  <div className="text-[22px] font-bold text-white">{v}</div>
                  <div className="text-[11px] font-medium text-slate-300">{l}</div>
                  <div className="text-[9px] uppercase tracking-wide text-mut">{sub}</div>
                </div>
              ))}
            </section>

            {/* giardini */}
            <section className="rounded-2xl border border-line/60 bg-ink-900/60 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-100">
                  <Sprout size={15} className="text-emerald-400" /> Commit Garden
                </h2>
                <span className="text-[11px] text-mut">
                  {snap.garden.contributors} contributor · {snap.garden.totalWaterings} innaffiature
                </span>
              </div>
              {snap.garden.top.length === 0 ? (
                <p className="text-[12px] text-mut">Ancora nessun giardino coltivato.</p>
              ) : (
                <ol className="space-y-1.5">
                  {snap.garden.top.map((g, i) => (
                    <li key={g.user} className="flex items-center gap-2.5">
                      <span className="w-4 text-[12px] font-bold text-mut">{i + 1}</span>
                      <span className="select-none">{STAGE_EMOJI[g.stage] ?? "🌱"}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-200">{g.user}</span>
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-700">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{ width: `${g.growth}%` }} />
                      </div>
                      <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-mut">{g.waterings}×</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <p className="pt-2 text-center text-[10px] text-mut">
              Aggiornato {new Date(snap.generatedAt).toLocaleTimeString("it-IT")} · aggiornamento automatico ogni 10s
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
