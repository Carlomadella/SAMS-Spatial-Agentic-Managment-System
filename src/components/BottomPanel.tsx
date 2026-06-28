import { AlertTriangle, ChevronDown, Cpu, Trash2 } from "lucide-react";
import { useStore } from "../store/useStore";
import type { BottomTab } from "../types";
import { EventLog } from "./EventLog";
import { AgentInspector } from "./AgentInspector";
import { TasksPanel } from "./TasksPanel";
import { HistoryPanel } from "./HistoryPanel";
import { LiveSimPanel } from "./LiveSimPanel";
import { ResizeHandle } from "./ResizeHandle";
import { cn } from "../lib/utils";

function TerminalView() {
  const environment = useStore((s) => s.environment);
  return (
    <div className="h-full overflow-y-auto px-3 py-2 font-mono text-[12px] leading-relaxed text-slate-300">
      <div className="text-mut">SAMS runtime · spatial agentic shell</div>
      <div>
        <span className="text-emerald-400">sams@workspace</span>
        <span className="text-mut">:</span>
        <span className="text-brand-soft">~/{environment}</span>
        <span className="text-mut">$ </span>
        agents --status
      </div>
      <div className="text-mut">› use the Agent panel to spawn, command and dispatch agents.</div>
      <div className="flex items-center">
        <span className="text-emerald-400">sams@workspace</span>
        <span className="text-mut">:</span>
        <span className="text-brand-soft">~/{environment}</span>
        <span className="text-mut">$ </span>
        <span className="ml-0.5 inline-block h-3.5 w-2 animate-pulse-soft bg-slate-300" />
      </div>
    </div>
  );
}

function OutputView() {
  return (
    <div className="h-full overflow-y-auto px-3 py-2 font-mono text-[12px] leading-relaxed text-slate-300">
      <div><span className="text-mut">[build]</span> spatial scene compiled in 142ms</div>
      <div><span className="text-mut">[runtime]</span> 6 agent slots initialized</div>
      <div><span className="text-emerald-400">[ready]</span> workspace online · SAMS connected</div>
    </div>
  );
}

function ProblemsView() {
  const agents = useStore((s) => s.agents);
  const problems = agents.filter((a) => a.status === "blocked" || a.status === "review");

  if (problems.length === 0) {
    return <div className="px-3 py-3 text-[12px] text-mut">No problems detected.</div>;
  }
  return (
    <div className="h-full overflow-y-auto px-3 py-2 text-[12px]">
      {problems.map((a) => (
        <div key={a.id} className="flex items-center gap-2 py-1">
          <AlertTriangle size={14} className="text-amber-400" />
          <span className="text-slate-300">
            <span className="font-medium">{a.name}</span>{" "}
            {a.status === "blocked" ? "is blocked and needs attention" : "is waiting for review"}
            {a.task ? ` · ${a.task.title}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

const TABS: { id: BottomTab; label: string; sim?: true }[] = [
  { id: "terminal", label: "Terminal" },
  { id: "output", label: "Output" },
  { id: "eventlog", label: "Event Log" },
  { id: "tasks", label: "Tasks" },
  { id: "history", label: "History" },
  { id: "problems", label: "Problems" },
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
              title="Clear"
              aria-label="Svuota"
              onClick={bottomTab === "eventlog" ? clearEvents : clearTasks}
              className="btn h-7 w-7 px-0"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button title="Hide panel" aria-label="Nascondi pannello" onClick={toggleBottom} className="btn h-7 w-7 px-0">
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* content + inspector */}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {bottomTab === "terminal" && <TerminalView />}
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
