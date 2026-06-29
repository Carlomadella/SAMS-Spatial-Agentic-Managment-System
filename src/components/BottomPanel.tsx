import { AlertTriangle, Check, ChevronDown, Clock, Cpu, Trash2 } from "lucide-react";
import { useStore } from "../store/useStore";
import type { BottomTab } from "../types";
import { EventLog } from "./EventLog";
import { AgentInspector } from "./AgentInspector";
import { TasksPanel } from "./TasksPanel";
import { HistoryPanel } from "./HistoryPanel";
import { LiveSimPanel } from "./LiveSimPanel";
import { Terminal } from "./Terminal";
import { OutputView } from "./OutputView";
import { ResizeHandle } from "./ResizeHandle";
import { cn } from "../lib/utils";

function ProblemsView() {
  const agents = useStore((s) => s.agents);
  const selectAgent = useStore((s) => s.selectAgent);
  const problems = agents.filter((a) => a.status === "blocked" || a.status === "review");

  if (problems.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
        <Check size={18} className="text-emerald-400/70" />
        <span className="text-[12px] text-mut">Nessun problema rilevato.</span>
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto px-2 py-1.5 text-[12px]">
      {problems.map((a) => {
        const blocked = a.status === "blocked";
        return (
          <button
            key={a.id}
            onClick={() => selectAgent(a.id)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-ink-700/60"
          >
            {blocked ? (
              <AlertTriangle size={14} className="shrink-0 text-rose-400" />
            ) : (
              <Clock size={14} className="shrink-0 text-amber-400" />
            )}
            <span className="min-w-0 flex-1 truncate text-slate-300">
              <span className="font-medium text-slate-200">{a.name}</span>{" "}
              {blocked ? "è bloccato e richiede attenzione" : "è in attesa di review"}
              {a.task ? ` · ${a.task.title}` : ""}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                blocked ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300",
              )}
            >
              {blocked ? "bloccato" : "in revisione"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const TABS: { id: BottomTab; label: string; sim?: true }[] = [
  { id: "terminal", label: "Terminale" },
  { id: "output", label: "Output" },
  { id: "eventlog", label: "Log eventi" },
  { id: "tasks", label: "Task" },
  { id: "history", label: "Cronologia" },
  { id: "problems", label: "Problemi" },
  { id: "livesim", label: "Live Sim", sim: true },
];

export function BottomPanel() {
  const bottomTab = useStore((s) => s.bottomTab);
  const setBottomTab = useStore((s) => s.setBottomTab);
  const toggleBottom = useStore((s) => s.toggleBottom);
  const clearEvents = useStore((s) => s.clearEvents);
  const clearTasks = useStore((s) => s.clearTasks);
  const bottomHeight = useStore((s) => s.bottomHeight);
  const setBottomHeight = useStore((s) => s.setBottomHeight);
  const simMode = useStore((s) => s.simMode);
  const problemCount = useStore(
    (s) => s.agents.filter((a) => a.status === "blocked" || a.status === "review").length,
  );

  return (
    <div
      className="relative flex shrink-0 flex-col border-t border-line bg-gradient-to-b from-ink-850 to-ink-900"
      style={{ height: bottomHeight }}
    >
      <ResizeHandle side="top" onDelta={(d) => setBottomHeight(useStore.getState().bottomHeight - d)} />
      {/* tab bar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-line pr-2">
        <div className="flex h-full items-stretch">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setBottomTab(t.id)}
              className={cn(
                "relative flex items-center gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                bottomTab === t.id ? "bg-white/[0.04] text-white" : "text-mut hover:bg-white/[0.02] hover:text-slate-300",
              )}
            >
              {t.sim && (
                <Cpu size={11} className={cn("shrink-0", simMode ? "text-emerald-400" : "")} />
              )}
              {t.label}
              {t.sim && simMode && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
              )}
              {t.id === "problems" && problemCount > 0 && (
                <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-300">
                  {problemCount}
                </span>
              )}
              {bottomTab === t.id && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {(bottomTab === "eventlog" || bottomTab === "tasks") && (
            <button
              title="Svuota"
              aria-label="Svuota"
              onClick={bottomTab === "eventlog" ? clearEvents : clearTasks}
              className="btn h-7 w-7 px-0"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button title="Nascondi pannello" aria-label="Nascondi pannello" onClick={toggleBottom} className="btn h-7 w-7 px-0">
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* content + inspector */}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {bottomTab === "terminal" && <Terminal />}
          {bottomTab === "output" && <OutputView />}
          {bottomTab === "eventlog" && <EventLog />}
          {bottomTab === "tasks" && <TasksPanel />}
          {bottomTab === "history" && <HistoryPanel />}
          {bottomTab === "problems" && <ProblemsView />}
          {bottomTab === "livesim" && <LiveSimPanel />}
        </div>
        <div className="w-80 shrink-0 border-l border-line bg-ink-900/70">
          <AgentInspector />
        </div>
      </div>
    </div>
  );
}
