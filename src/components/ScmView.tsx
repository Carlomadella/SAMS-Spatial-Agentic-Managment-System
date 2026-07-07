import { useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  FileCode2,
  GitBranch,
  GitCommit,
  GitFork,
  X,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { STATIC_TREE } from "../data/seed";
import { AGENT_HEX, type Agent, type EnvironmentName, type PendingFile } from "../types";
import { approveChanges, rejectChanges } from "../lib/backend";
import { gradeChanges, type QualityGrade } from "../lib/quality";
import { flattenBadgedFiles } from "../lib/fileTree";
import { StagedFileDiff } from "./StagedFileDiff";
import { GitGraph } from "./GitGraph";
import { cn } from "../lib/utils";

const BADGE_CLS: Record<string, string> = {
  M: "text-amber-400",
  U: "text-emerald-400",
  A: "text-emerald-400",
};

const ENV_CHIP: Record<string, string> = {
  dev: "bg-sky-500/15 text-sky-300 border-sky-500/25",
  staging: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  prod: "bg-rose-500/15 text-rose-300 border-rose-500/25",
};

const STATUS_BAR: Record<string, string> = {
  working: "bg-brand animate-pulse-soft",
  review: "bg-amber-400",
  blocked: "bg-rose-500",
  done: "bg-emerald-400",
  awaiting_approval: "bg-violet-400 animate-pulse-soft",
  idle: "bg-slate-600",
};

function SectionHeader({
  label,
  count,
  open,
  onToggle,
}: {
  label: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-mut transition-colors hover:text-slate-300"
    >
      {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      {label}
      {count != null && (
        <span className="rounded-full bg-ink-700 px-1.5 text-[9px]">{count}</span>
      )}
    </button>
  );
}

const GRADE_CLS: Record<QualityGrade, string> = {
  A: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  B: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  C: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  D: "border-rose-500/40 bg-rose-500/15 text-rose-300",
};

/** Voto di qualità pre-PR sui file in staging (euristica locale, vedi lib/quality). */
function QualityBadge({ files }: { files: PendingFile[] }) {
  const report = gradeChanges(files);
  return (
    <span
      title={`Qualità ${report.grade} · ${report.score}/100\n${report.reasons.join("\n")}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold",
        GRADE_CLS[report.grade],
      )}
    >
      ⚑ {report.grade}
    </span>
  );
}

function PendingCard({ agent }: { agent: Agent }) {
  const [busy, setBusy] = useState(false);
  const log = useStore((s) => s.log);

  async function handleApprove() {
    setBusy(true);
    try {
      await approveChanges(agent.id);
    } catch (err) {
      log({
        agentId: agent.id,
        agentName: agent.name,
        color: agent.color,
        level: "ERROR",
        message: `Approvazione fallita: ${(err as Error).message}`,
      });
    } finally {
      setBusy(false);
    }
  }

  function handleReject() {
    rejectChanges(agent.id).catch(() => {});
  }

  return (
    <div className="mx-1 mb-2 overflow-hidden rounded-lg border border-violet-500/25 bg-violet-500/5">
      {/* agent bar */}
      <div className="flex items-center gap-2 border-b border-violet-500/15 px-2 py-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/20"
          style={{ background: AGENT_HEX[agent.color] }}
        />
        <span className="flex-1 text-[11px] font-medium text-slate-200">{agent.name}</span>
        <QualityBadge files={agent.pendingFiles!} />
        <span className="truncate font-mono text-[10px] text-mut">{agent.task?.branch ?? "—"}</span>
      </div>

      {/* diff list */}
      <div className="max-h-52 space-y-1 overflow-y-auto p-2">
        {agent.pendingFiles!.map((f, i) => (
          <StagedFileDiff key={i} file={f} />
        ))}
      </div>

      {/* action buttons */}
      <div className="flex gap-1.5 border-t border-violet-500/15 px-2 py-1.5">
        <button
          onClick={handleApprove}
          disabled={busy}
          className="btn btn-primary flex-1 gap-1.5 text-[11px] disabled:opacity-50"
        >
          <Check size={11} className="shrink-0" />
          {busy ? "Commit…" : "Approva e committa"}
        </button>
        <button
          onClick={handleReject}
          className="btn gap-1 border-rose-500/30 px-2.5 text-[11px] text-rose-300 hover:bg-rose-500/10"
          title="Rifiuta modifiche"
        >
          <X size={11} />
        </button>
      </div>
    </div>
  );
}

export function ScmView() {
  const agents = useStore((s) => s.agents);
  const environment = useStore((s) => s.environment);
  const setEnvironment = useStore((s) => s.setEnvironment);

  const [showGraph, setShowGraph] = useState(false);
  const [showBranches, setShowBranches] = useState(true);
  const [showChanges, setShowChanges] = useState(false);

  const pendingAgents = agents.filter((a) => (a.pendingFiles?.length ?? 0) > 0);
  const activeAgents = agents.filter((a) => !!a.task);
  const workspaceChanges = flattenBadgedFiles(STATIC_TREE);

  return (
    <div className="flex h-full flex-col">
      {/* panel title */}
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-mut">
          Controllo sorgente
        </span>
        <button
          onClick={() => setShowGraph((v) => !v)}
          title="Git Graph"
          aria-label="Mostra Git Graph"
          className={cn(
            "flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
            showGraph
              ? "bg-brand/20 text-brand-soft"
              : "text-mut hover:bg-ink-700 hover:text-slate-300",
          )}
        >
          <GitFork size={12} />
          Git Graph
        </button>
      </div>

      {/* branch + env row */}
      <div className="flex shrink-0 items-center gap-2 border-b border-line/60 bg-ink-850/40 px-3 py-1.5">
        <GitBranch size={12} className="shrink-0 text-brand-soft" />
        <span className="flex-1 font-mono text-[12px] text-slate-300">main</span>
        <select
          value={environment}
          onChange={(e) => setEnvironment(e.target.value as EnvironmentName)}
          className={cn(
            "cursor-pointer rounded border px-1.5 py-0.5 text-[10px] font-semibold outline-none",
            ENV_CHIP[environment],
            "bg-transparent",
          )}
        >
          <option value="dev">dev</option>
          <option value="staging">staging</option>
          <option value="prod">prod</option>
        </select>
      </div>

      {/* Git Graph view */}
      {showGraph && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <GitGraph />
        </div>
      )}

      {/* Normal SCM body */}
      {!showGraph && <div className="min-h-0 flex-1 overflow-y-auto pb-4">

        {/* ── Pending approvals ── */}
        {pendingAgents.length > 0 && (
          <div className="mt-2">
            <div className="mb-1.5 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-violet-400">
              <AlertCircle size={11} />
              In attesa di approvazione
              <span className="rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[9px] text-violet-300">
                {pendingAgents.length}
              </span>
            </div>
            {pendingAgents.map((a) => (
              <PendingCard key={a.id} agent={a} />
            ))}
          </div>
        )}

        {/* ── Active branches ── */}
        {activeAgents.length > 0 && (
          <div className={cn("mb-1", pendingAgents.length > 0 && "mt-1")}>
            <SectionHeader
              label="Branch attivi"
              count={activeAgents.length}
              open={showBranches}
              onToggle={() => setShowBranches((o) => !o)}
            />
            {showBranches && (
              <div className="space-y-0.5 px-1">
                {activeAgents.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-ink-700/50"
                  >
                    {/* colored status dot */}
                    <span
                      className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_BAR[a.status])}
                    />
                    {/* branch name */}
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-300">
                      {a.task!.branch || "main"}
                    </span>
                    {/* progress pill */}
                    {a.task!.progress >= 100 ? (
                      <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                        ✓ completato
                      </span>
                    ) : (
                      <span className="rounded-full bg-ink-700 px-1.5 py-0.5 font-mono text-[9px] text-mut">
                        {a.task!.progress}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Workspace changes ── */}
        {workspaceChanges.length > 0 && (
          <div className="mb-1 mt-1">
            <SectionHeader
              label="Modifiche workspace"
              count={workspaceChanges.length}
              open={showChanges}
              onToggle={() => setShowChanges((o) => !o)}
            />
            {showChanges && (
              <div className="space-y-0.5 px-1">
                {workspaceChanges.map((f) => (
                  <div
                    key={f.path}
                    className="flex items-center gap-2 rounded px-2 py-[3px] hover:bg-ink-700/50"
                  >
                    <FileCode2 size={12} className="shrink-0 text-slate-500" />
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-400">
                      {f.path}
                    </span>
                    <span
                      className={cn("shrink-0 font-mono text-[10px] font-semibold", BADGE_CLS[f.badge])}
                    >
                      {f.badge}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Empty state ── */}
        {pendingAgents.length === 0 && activeAgents.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <GitCommit size={22} className="text-mut/40" />
            <p className="text-[12px] text-mut">Nessuna modifica in attesa</p>
            <p className="text-[10px] text-mut/60">
              I file committati dagli agenti appariranno qui
            </p>
          </div>
        )}
      </div>}
    </div>
  );
}
