import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search, X } from "lucide-react";
import { fetchHistory, type TaskHistoryRow } from "../lib/backend";
import { colorFromAgentId } from "../lib/agentColor";
import { STATUS_META } from "../lib/meta";
import type { AgentStatus } from "../types";
import { cn } from "../lib/utils";

const statusLabel = (s: string) => STATUS_META[s as AgentStatus]?.label ?? s;

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

const STATUS_CHIP: Record<string, string> = {
  done:    "bg-emerald-500/15 text-emerald-300",
  review:  "bg-amber-500/15 text-amber-300",
  blocked: "bg-rose-500/15 text-rose-300",
  working: "bg-brand/15 text-brand-soft",
  idle:    "bg-ink-700 text-mut",
};

/** Durable task history from the runtime DB — survives restarts. */
export function HistoryPanel() {
  const [rows, setRows] = useState<TaskHistoryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    try {
      const data = await fetchHistory();
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const agentNames = useMemo(() => {
    if (!rows) return [];
    return [...new Set(rows.map((r) => r.agentName))].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (agentFilter !== "all" && r.agentName !== agentFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !`${r.title} ${r.agentName} ${r.branch}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, agentFilter, statusFilter]);

  if (rows === null) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[12px] text-mut">
        <Loader2 size={14} className="animate-spin" /> Carico lo storico…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* toolbar */}
      <div className="shrink-0 space-y-1 border-b border-line/40 px-2 py-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-mut">
            {filtered.length}/{rows.length} {rows.length === 1 ? "operazione" : "operazioni"}
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-mut transition-colors hover:bg-ink-700 hover:text-slate-300 disabled:opacity-40"
          >
            <RefreshCw size={10} className={cn(loading && "animate-spin")} /> Aggiorna
          </button>
        </div>

        {/* search */}
        <div className="relative">
          <Search size={10} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-mut" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca task, agente, branch…"
            className="w-full rounded border border-line bg-ink-800 py-0.5 pl-5 pr-5 text-[10px] text-slate-200 outline-none placeholder:text-mut/60 focus:border-brand/50"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-mut hover:text-slate-300">
              <X size={10} />
            </button>
          )}
        </div>

        {/* filters */}
        <div className="flex gap-1">
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="flex-1 rounded border border-line bg-ink-800 px-1 py-0.5 text-[10px] text-slate-200 outline-none"
          >
            <option value="all">Tutti gli agenti</option>
            {agentNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-line bg-ink-800 px-1 py-0.5 text-[10px] text-slate-200 outline-none"
          >
            <option value="all">Tutti gli stati</option>
            <option value="done">Completato</option>
            <option value="review">In revisione</option>
            <option value="blocked">Bloccato</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-3 py-4 text-[12px] text-mut">
          {rows.length === 0 ? "Nessun task registrato. I task completati appariranno qui e persistono ai riavvii." : "Nessun risultato per i filtri selezionati."}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.map((r, i) => {
            const color = colorFromAgentId(r.agentId);
            const chipCls = STATUS_CHIP[r.status] ?? STATUS_CHIP.idle;
            return (
              <div
                key={i}
                className="group flex items-start gap-2 border-b border-line/30 px-2 py-2 hover:bg-ink-700/40"
              >
                {/* agent color dot */}
                <span
                  className="mt-0.5 h-2 w-2 shrink-0 rounded-full ring-1 ring-black/20"
                  style={{ background: color }}
                />

                {/* content */}
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[12px] font-medium text-slate-200"
                    title={r.title}
                  >
                    {r.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-mut">
                    <span>{r.agentName}</span>
                    {r.branch && (
                      <>
                        <span>·</span>
                        <span className="truncate font-mono" title={r.branch}>
                          {r.branch.length > 28 ? `…${r.branch.slice(-24)}` : r.branch}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* right side: status + meta */}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold", chipCls)}>
                    {statusLabel(r.status)}
                  </span>
                  <div className="flex items-center gap-1.5 text-[9px] text-mut">
                    {r.tokens > 0 && (
                      <span className="font-mono">{fmtTokens(r.tokens)} tok</span>
                    )}
                    <span>{fmtTime(r.ts)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
