import { ExternalLink } from "lucide-react";
import { useStore } from "../store/useStore";
import { AGENT_HEX } from "../types";
import { STATUS_META } from "../lib/meta";
import { clock, cn } from "../lib/utils";

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

/** History of assigned tasks with status, progress and result links. */
export function TasksPanel() {
  const tasks = useStore((s) => s.tasks);

  if (tasks.length === 0) {
    return (
      <div className="px-3 py-3 text-[12px] text-mut">
        Nessun task ancora. Seleziona un agente e assegnagli un task.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-2 py-2">
      {[...tasks].reverse().map((t) => {
        const meta = STATUS_META[t.status];
        return (
          <div key={t.id} className="mb-1.5 rounded-md border border-line bg-ink-850/60 px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: t.color ? AGENT_HEX[t.color] : "#8a93a6" }}
              />
              <span className="text-[12px] font-medium text-slate-200">{t.agentName}</span>
              <span className={cn("chip bg-ink-800", meta.text)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} /> {meta.label}
              </span>
              <span className="ml-auto shrink-0 font-mono text-[10px] text-mut">{clock(t.createdAt)}</span>
            </div>

            <div className="mt-1 truncate text-[12px] text-slate-300" title={t.title}>
              {t.title}
            </div>

            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-mut">
              <span className="truncate font-mono">{t.branch}</span>
              {t.assignedBy ? (
                <span className="shrink-0" title={`Assegnato da ${t.assignedBy}`}>
                  · {t.status === "done" ? "completato per" : "da"} {t.assignedBy}
                </span>
              ) : null}
              {t.tokens ? <span className="shrink-0">· {fmtTokens(t.tokens)} tok</span> : null}
              {t.url && (
                <a
                  href={t.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex shrink-0 items-center gap-1 text-brand-soft hover:underline"
                >
                  <ExternalLink size={11} /> apri
                </a>
              )}
            </div>

            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ink-700">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${t.progress}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
