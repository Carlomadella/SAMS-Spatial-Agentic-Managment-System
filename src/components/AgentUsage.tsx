import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { backendEnabled } from "../lib/backend";
import { canAssign } from "../lib/roleUi";
import { agentCapWarning, capState, quotaWarning, refreshUsage, setAgentCapRemote, useUsage } from "../lib/usage";
import { cn } from "../lib/utils";

const POLL_MS = 60_000;

/** Aggiorna i conteggi ogni minuto finché il runtime è collegato (montato nella barra in basso). */
export function useUsagePolling(): void {
  const online = useStore((s) => s.backendOnline);
  useEffect(() => {
    if (!backendEnabled || !online) return;
    void refreshUsage();
    const h = setInterval(() => void refreshUsage(), POLL_MS);
    return () => clearInterval(h);
  }, [online]);
}

/** Scheda dell'agente: richieste di oggi e tetto giornaliero facoltativo (idea 1, scelta C). */
export function AgentUsageBox({ agentId }: { agentId: string }) {
  const a = useUsage((s) => s.usage?.agents[agentId]);
  const viewerRole = useStore((s) => s.viewerRole);
  const used = a?.requests ?? 0;
  const cap = a?.cap ?? 0;
  const [draft, setDraft] = useState(cap ? String(cap) : "");
  const [err, setErr] = useState("");
  useEffect(() => setDraft(cap ? String(cap) : ""), [cap, agentId]);

  const st = capState(used, cap);
  const warn = agentCapWarning(a);
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const save = () => {
    const n = Math.floor(Number(draft || 0));
    if (n === cap) return;
    setErr("");
    setAgentCapRemote(agentId, Number.isFinite(n) && n > 0 ? n : 0).catch((e: Error) => setErr(e.message));
  };

  return (
    <div className="mt-2 rounded-lg border border-line bg-ink-850/60 px-2.5 py-2" data-testid="agent-usage">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-mut">Richieste oggi</span>
        <span className="font-mono text-slate-200">
          {used}
          {cap > 0 ? ` / ${cap}` : ""}
          {a?.avgPerTask ? <span className="ml-1 text-mut">· ~{a.avgPerTask} per task</span> : null}
        </span>
      </div>
      {cap > 0 && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div
            className={cn("h-full rounded-full", st === "reached" ? "bg-rose-500" : st === "near" ? "bg-amber-400" : "bg-emerald-400")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <label className="mt-1.5 flex items-center gap-2 text-[11px] text-mut">
        <span className="shrink-0">Tetto al giorno</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          disabled={!canAssign(viewerRole)}
          inputMode="numeric"
          placeholder="nessuno"
          title="Raggiunto il tetto l'agente non parte; all'80% compare un avviso. Vuoto = nessun tetto."
          className="w-20 rounded-md border border-line bg-ink-800 px-2 py-0.5 font-mono text-[11px] text-slate-200 outline-none placeholder:text-mut/60 focus:border-brand/50"
        />
      </label>
      {warn && <p className={cn("mt-1 text-[11px] leading-snug", st === "reached" ? "text-rose-400" : "text-amber-300")}>{warn}</p>}
      {err && <p className="mt-1 text-[11px] text-rose-400">{err}</p>}
    </div>
  );
}

/** Avviso sopra «Assegna task»: la quota del provider rimasta probabilmente non basta. Si può assegnare lo stesso. */
export function QuotaHint({ agentId }: { agentId: string }) {
  const usage = useUsage((s) => s.usage);
  const msg = quotaWarning(usage, agentId) ?? agentCapWarning(usage?.agents[agentId]);
  if (!msg) return null;
  return (
    <p className="text-[11px] leading-snug text-amber-300" data-testid="quota-hint">
      ⚠ {msg}
    </p>
  );
}
