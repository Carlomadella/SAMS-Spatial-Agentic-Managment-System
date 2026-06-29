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
      title: "Apri pull request",
      sub: "Crea una PR per le modifiche in staging",
      onClick: () => run("Aperta pull request per le modifiche in staging", "INFO"),
    },
    {
      icon: GitCompare,
      title: "Rivedi diff",
      sub: "Visualizza modifiche e commenti",
      onClick: () => run("Aperta revisione del diff", "INFO"),
    },
    {
      icon: GitCommitHorizontal,
      title: "Committa tutto",
      sub: "Aggiungi e committa tutte le modifiche",
      onClick: () => run("Committate tutte le modifiche in staging", "SUCCESS"),
    },
    {
      icon: UploadCloud,
      title: "Push al remoto",
      sub: `Push su origin/${environment}`,
      onClick: () => run(`Push effettuato su origin/${environment}`, "SUCCESS"),
    },
    {
      icon: ShieldCheck,
      title: "Regole di accesso",
      sub: "Gestisci i permessi del gate",
      onClick: () => run("Riviste le regole di accesso", "INFO"),
    },
    {
      icon: GitMerge,
      title: "Unisci workflow",
      sub: "Unisci nel workflow principale",
      onClick: () => run("Unito nel workflow principale", "SUCCESS"),
    },
    {
      icon: CheckCircle2,
      title: "Approva gate",
      sub: "Approva e distribuisci le modifiche",
      onClick: () => run("Gate di sicurezza approvato — distribuzione in corso", "SUCCESS"),
    },
    {
      icon: Copy,
      title: "Duplica",
      sub: "Crea una copia di questo gate",
      onClick: () => run("Gate di sicurezza duplicato", "INFO"),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* gate header */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400" />
          <span className="text-[12px] font-semibold text-slate-100">Gate di sicurezza</span>
        </div>
        <span className="chip bg-emerald-500/15 text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Accesso consentito
        </span>
      </div>

      {/* env switch */}
      <div className="px-3 py-2.5">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-mut">
          Controllo sorgente
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
          <MoreHorizontal size={16} /> Altre azioni
        </button>
      </div>
    </div>
  );
}
