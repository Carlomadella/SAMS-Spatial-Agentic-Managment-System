import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchHistory, type TaskHistoryRow } from "../lib/backend";
import { cn } from "../lib/utils";

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

const DOT: Record<string, string> = {
  review: "bg-emerald-400",
  done: "bg-emerald-400",
  idle: "bg-slate-500",
  blocked: "bg-rose-400",
};

/** Durable task history from the runtime DB (survives restarts). */
export function HistoryPanel() {
  const [rows, setRows] = useState<TaskHistoryRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchHistory().then((r) => alive && setRows(r));
    return () => {
      alive = false;
    };
  }, []);

  if (rows === null) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[12px] text-mut">
        <Loader2 size={14} className="animate-spin" /> Carico lo storico…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="px-3 py-3 text-[12px] text-mut">
        Nessun task registrato ancora. I task completati appariranno qui e persistono ai riavvii del runtime.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-2 py-1 text-[12px]">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 border-b border-line/40 py-1.5">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[r.status] ?? "bg-slate-500")} />
          <span className="min-w-0 flex-1 truncate text-slate-200" title={r.title}>{r.title}</span>
          <span className="shrink-0 text-mut">{r.agentName}</span>
          {r.tokens > 0 && <span className="shrink-0 font-mono text-[10px] text-mut">{r.tokens} tok</span>}
          <span className="shrink-0 font-mono text-[10px] text-mut">{fmtTime(r.ts)}</span>
        </div>
      ))}
    </div>
  );
}
