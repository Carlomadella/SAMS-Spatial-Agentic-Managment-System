import {
  CheckCircle2,
  Copy,
  GitCommitHorizontal,
  GitCompare,
  GitMerge,
  GitPullRequest,
  MoreHorizontal,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useStore } from "../store/useStore";
import type { EnvironmentName, LogLevel } from "../types";
import { cn } from "../lib/utils";

const ENVS: EnvironmentName[] = ["dev", "staging", "prod"];

export function ActionsPanel() {
  const environment = useStore((s) => s.environment);
  const setEnvironment = useStore((s) => s.setEnvironment);
  const log = useStore((s) => s.log);
  const setBottomTab = useStore((s) => s.setBottomTab);

  function run(message: string, level: LogLevel) {
    log({ agentId: null, agentName: "source-control", color: null, level, message });
    setBottomTab("eventlog");
  }

  const actions: {
    icon: LucideIcon;
    title: string;
    sub: string;
    onClick: () => void;
  }[] = [
    {
      icon: GitPullRequest,
      title: "Open Pull Request",
      sub: "Create PR for staged changes",
      onClick: () => run("Opened pull request for staged changes", "INFO"),
    },
    {
      icon: GitCompare,
      title: "Review Diff",
      sub: "View changes and comments",
      onClick: () => run("Opened diff review", "INFO"),
    },
    {
      icon: GitCommitHorizontal,
      title: "Commit All",
      sub: "Stage and commit all changes",
      onClick: () => run("Committed all staged changes", "SUCCESS"),
    },
    {
      icon: UploadCloud,
      title: "Push to Remote",
      sub: `Push to origin/${environment}`,
      onClick: () => run(`Pushed to origin/${environment}`, "SUCCESS"),
    },
    {
      icon: ShieldCheck,
      title: "Access Rules",
      sub: "Manage gate permissions",
      onClick: () => run("Reviewed access rules", "INFO"),
    },
    {
      icon: GitMerge,
      title: "Merge Workflow",
      sub: "Merge into main workflow",
      onClick: () => run("Merged into main workflow", "SUCCESS"),
    },
    {
      icon: CheckCircle2,
      title: "Approve Gate",
      sub: "Approve and deploy changes",
      onClick: () => run("Security gate approved — deploying", "SUCCESS"),
    },
    {
      icon: Copy,
      title: "Duplicate",
      sub: "Create a copy of this gate",
      onClick: () => run("Duplicated security gate", "INFO"),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* gate header */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400" />
          <span className="text-[12px] font-semibold text-slate-100">Security Gate</span>
        </div>
        <span className="chip bg-emerald-500/15 text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Access Granted
        </span>
      </div>

      {/* env switch */}
      <div className="px-3 py-2.5">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-mut">
          Source Control
        </div>
        <div className="flex rounded-md border border-line bg-ink-850 p-0.5">
          {ENVS.map((e) => (
            <button
              key={e}
              onClick={() => setEnvironment(e)}
              className={cn(
                "flex-1 rounded px-2 py-1 text-[11px] font-medium capitalize transition-colors",
                environment === e ? "bg-brand text-white" : "text-mut hover:text-slate-200",
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* actions */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {actions.map((a) => (
          <button
            key={a.title}
            onClick={a.onClick}
            className="group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-ink-700"
          >
            <a.icon size={16} className="shrink-0 text-slate-400 group-hover:text-brand-soft" />
            <span className="flex-1">
              <span className="block text-[12.5px] text-slate-200">{a.title}</span>
              <span className="block text-[11px] text-mut">{a.sub}</span>
            </span>
          </button>
        ))}
        <button className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-[12px] text-mut hover:bg-ink-700 hover:text-slate-200">
          <MoreHorizontal size={16} /> More Actions
        </button>
      </div>
    </div>
  );
}
