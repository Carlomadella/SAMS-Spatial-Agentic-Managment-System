import { ChevronRight, GitCompare, History, ListTree, ShieldAlert, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useStore } from "../store/useStore";
import { AGENT_HEX, type EnvironmentName } from "../types";
import { cn } from "../lib/utils";
import { effectiveBranch } from "../lib/environments";

const ENVS: EnvironmentName[] = ["dev", "staging", "prod"];

/**
 * Gate di sicurezza: lo stato **vero** delle modifiche che aspettano un'approvazione
 * (i file in staging degli agenti) e scorciatoie verso le viste dove si agisce davvero.
 * Approvare o rifiutare resta in Controllo sorgente, che conosce diff, voto e ruoli.
 * Prima qui c'erano 8 bottoni che scrivevano nel log eventi inventati ("Push effettuato").
 */
export function ActionsPanel() {
  const environment = useStore((s) => s.environment);
  const setEnvironment = useStore((s) => s.setEnvironment);
  const envBranches = useStore((s) => s.envBranches);
  const runtimeBranch = useStore((s) => s.runtimeBranch);
  const current = effectiveBranch(environment, envBranches, runtimeBranch);
  const agents = useStore((s) => s.agents);
  const selectAgent = useStore((s) => s.selectAgent);
  const setActivity = useStore((s) => s.setActivity);
  const setLeftOpen = useStore((s) => s.setLeftOpen);
  const setBottomTab = useStore((s) => s.setBottomTab);

  const pending = agents.filter((a) => (a.pendingFiles?.length ?? 0) > 0);

  function openScm(agentId?: string) {
    if (agentId) selectAgent(agentId);
    setActivity("scm");
    setLeftOpen(true);
  }

  const shortcuts: { icon: LucideIcon; title: string; sub: string; onClick: () => void }[] = [
    {
      icon: GitCompare,
      title: "Controllo sorgente",
      sub: "Diff, voto di qualità, approva o rifiuta",
      onClick: () => openScm(),
    },
    {
      icon: History,
      title: "Cronologia task",
      sub: "Task conclusi, esiti e token",
      onClick: () => setBottomTab("history"),
    },
    {
      icon: ListTree,
      title: "Log eventi",
      sub: "Cosa è successo, in ordine",
      onClick: () => setBottomTab("eventlog"),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* gate header: stato reale */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <div className="flex items-center gap-2">
          {pending.length > 0 ? (
            <ShieldAlert size={16} className="text-rose-400" />
          ) : (
            <ShieldCheck size={16} className="text-emerald-400" />
          )}
          <span className="text-[12px] font-semibold text-slate-100">Gate di sicurezza</span>
        </div>
        {pending.length > 0 ? (
          <span className="chip bg-rose-500/15 text-rose-300">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-rose-400" /> {pending.length} in attesa
          </span>
        ) : (
          <span className="chip bg-emerald-500/15 text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Nessuna in attesa
          </span>
        )}
      </div>

      {/* env switch */}
      <div className="px-3 py-2.5">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-mut">
          Ambiente
        </div>
        <div className="flex rounded-md border border-line bg-ink-850 p-0.5">
          {ENVS.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={environment === e}
              onClick={() => setEnvironment(e)}
              title={envBranches[e] ? `I task in ${e} partono da ${envBranches[e]}` : `Nessun branch dedicato a ${e}: vale il branch base`}
              className={cn(
                "flex-1 rounded px-2 py-1 text-[11px] font-medium capitalize transition-colors",
                environment === e ? "bg-brand text-white" : "text-mut hover:text-slate-200",
              )}
            >
              {e}
            </button>
          ))}
        </div>
        {current.branch && (
          <p className="mt-1.5 truncate text-[10px] text-mut" title={current.dedicated ? undefined : "L'owner può dare un branch a ogni ambiente in ⚙ → GitHub del server"}>
            I task partono da <code className="rounded bg-ink-700 px-1 text-slate-300">{current.branch}</code>
            {!current.dedicated && " (branch base)"}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {/* modifiche in attesa */}
        <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-mut">
          Da approvare
        </div>
        {pending.length === 0 ? (
          <p className="px-2 pb-2 text-[11.5px] text-mut">
            Nessuna modifica da approvare. Quando un agente scrive file, compaiono qui.
          </p>
        ) : (
          pending.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => openScm(a.id)}
              className="group flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-ink-700"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: AGENT_HEX[a.color] }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-slate-200">{a.name}</span>
                <span className="block truncate text-[11px] text-mut">{a.task?.title ?? "Modifiche in staging"}</span>
              </span>
              <span className="shrink-0 text-[11px] text-mut">{a.pendingFiles!.length} file</span>
              <ChevronRight size={14} className="shrink-0 text-mut group-hover:text-slate-200" />
            </button>
          ))
        )}

        {/* scorciatoie verso le viste reali */}
        <div className="mt-2 border-t border-line pt-2">
          {shortcuts.map((a) => (
            <button
              key={a.title}
              type="button"
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
        </div>
      </div>
    </div>
  );
}
