import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { fetchHistory, type TaskHistoryRow } from "../lib/backend";
import { colorFromAgentId } from "../lib/agentColor";
import { cn } from "../lib/utils";

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
      <div className="flex shrink-0 items-center justify-between border-b border-line/40 px-2 py-1">
        <span className="text-[10px] text-mut">
          {rows.length} {rows.length === 1 ? "operazione" : "operazioni"}
        </span>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-mut transition-colors hover:bg-ink-700 hover:text-slate-300 disabled:opacity-40"
        >
          <RefreshCw size={10} className={cn(loading && "animate-spin")} /> Aggiorna
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="px-3 py-4 text-[12px] text-mut">
          Nessun task registrato. I task completati appariranno qui e persistono ai riavvii.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.map((r, i) => {
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
                    {r.status}
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
