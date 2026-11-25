import { useEffect, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { useStore } from "../store/useStore";
import { canAssign } from "../lib/roleUi";
import { fetchAgentVersions, restoreAgentVersion, shortValue, versionSummary, type AgentVersion } from "../lib/agentVersions";

function when(ts: number): string {
  return new Date(ts).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Scheda dell'agente: storico della configurazione con le differenze e «Ripristina» (idea 6). */
export function AgentVersionsBox({ agentId }: { agentId: string }) {
  const viewerRole = useStore((s) => s.viewerRole);
  // Si rilegge quando la configurazione cambia (anche da un'altra vista o da un ripristino).
  const configKey = useStore((s) => {
    const a = s.agents.find((x) => x.id === agentId);
    return a ? [a.name, a.color, a.role, a.model, a.instructions, a.repo ?? "", a.squad ?? ""].join("\u0001") : "";
  });
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<AgentVersion[] | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    // Un attimo di respiro: chi scrive le istruzioni manda una modifica a ogni tasto.
    const h = setTimeout(() => {
      fetchAgentVersions(agentId)
        .then((v) => alive && setList(v))
        .catch((e: Error) => alive && setErr(e.message));
    }, 800);
    return () => {
      alive = false;
      clearTimeout(h);
    };
  }, [agentId, open, configKey]);

  const restore = (n: number) => {
    setBusy(true);
    setErr("");
    restoreAgentVersion(agentId, n)
      .then(() => fetchAgentVersions(agentId).then(setList))
      .catch((e: Error) => setErr(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <details
      className="mt-2 rounded-lg border border-line bg-ink-850/60"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      data-testid="agent-versions"
    >
      <summary className="flex cursor-pointer select-none items-center justify-between px-2.5 py-2 text-[11px] font-medium text-mut hover:text-slate-200">
        <span className="flex items-center gap-1.5">
          <History size={12} /> Versioni
        </span>
        <span className="text-[10px] opacity-60">{list ? `${list.length} salvate` : "configurazione"}</span>
      </summary>
      <div className="space-y-1 px-2.5 pb-2.5">
        {!list && !err && <p className="text-[11px] text-mut">Carico…</p>}
        {list?.length === 0 && <p className="text-[11px] text-mut">Ancora nessuna versione: si salva alla prossima modifica.</p>}
        {list?.map((v, i) => {
          const latest = i === 0;
          const first = i === list.length - 1 && v.n === 1;
          return (
            <div key={v.n} className="rounded-md border border-line/60 bg-ink-800/60 px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <button className="min-w-0 text-left" onClick={() => setShown(shown === v.n ? null : v.n)} title="Mostra le differenze">
                  <div className="truncate text-[11px] text-slate-200">
                    <span className="font-mono text-mut">v{v.n}</span> {versionSummary(v, first)}
                    {latest && <span className="ml-1 text-emerald-300">· attuale</span>}
                  </div>
                  <div className="text-[10px] text-mut">
                    {v.createdBy || "sconosciuto"} · {when(v.createdAt)}
                  </div>
                </button>
                {!latest && canAssign(viewerRole) && (
                  <button
                    disabled={busy}
                    onClick={() => restore(v.n)}
                    className="btn shrink-0 px-1.5 py-0.5 text-[10px]"
                    title="Torna a questa configurazione: si crea una versione nuova, le altre restano"
                  >
                    <RotateCcw size={11} /> Ripristina
                  </button>
                )}
              </div>
              {shown === v.n && (
                <div className="mt-1.5 space-y-1 border-t border-line/60 pt-1.5">
                  {v.changes.length === 0 && <p className="text-[10px] text-mut">Nessun campo diverso dalla versione prima.</p>}
                  {v.changes.map((c) => (
                    <div key={c.field} className="text-[10px] leading-snug">
                      <div className="font-medium text-slate-300">{c.label}</div>
                      <div className="whitespace-pre-wrap break-words text-rose-300/90 line-through decoration-rose-400/50">{shortValue(c.before)}</div>
                      <div className="whitespace-pre-wrap break-words text-emerald-300">{shortValue(c.after)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {err && <p className="text-[11px] text-rose-400">{err}</p>}
      </div>
    </details>
  );
}
