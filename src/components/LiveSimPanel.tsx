import { ExternalLink, Play, RefreshCw, Square } from "lucide-react";
import { useState } from "react";
import { fetchSimIssues, startSimMode, stopSimMode } from "../lib/backend";
import { useStore } from "../store/useStore";
import { cn } from "../lib/utils";

export function LiveSimPanel() {
  const simMode = useStore((s) => s.simMode);
  const setSimMode = useStore((s) => s.setSimMode);
  const simLabel = useStore((s) => s.simLabel);
  const setSimLabel = useStore((s) => s.setSimLabel);
  const simIssues = useStore((s) => s.simIssues);
  const setSimIssues = useStore((s) => s.setSimIssues);
  const agents = useStore((s) => s.agents);
  const backendOnline = useStore((s) => s.backendOnline);
  const runtimeReady = useStore((s) => s.runtimeReady);
  const webhookAutoAssign = useStore((s) => s.webhookAutoAssign);
  const setWebhookAutoAssign = useStore((s) => s.setWebhookAutoAssign);
  const [loading, setLoading] = useState(false);
  const [labelInput, setLabelInput] = useState(simLabel);

  const canStart = backendOnline && runtimeReady;
  const available = simIssues.filter((i) => !i.claimedBy).length;
  const inProgress = simIssues.filter((i) => !!i.claimedBy).length;

  async function toggle() {
    setLoading(true);
    try {
      if (simMode) {
        await stopSimMode();
        setSimMode(false);
      } else {
        setSimLabel(labelInput || "sams");
        await startSimMode(labelInput || "sams");
        setSimMode(true);
        const issues = await fetchSimIssues();
        setSimIssues(issues);
      }
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    const issues = await fetchSimIssues();
    setSimIssues(issues);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden text-[12px]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full transition-colors",
              simMode ? "animate-pulse-soft bg-emerald-400" : "bg-slate-600",
            )}
          />
          <span className="font-semibold text-slate-300">
            Live Sim{" "}
            <span className={simMode ? "text-emerald-400" : "text-mut"}>
              {simMode ? "— ATTIVA" : "— FERMA"}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          {simMode && (
            <button
              onClick={refresh}
              className="btn h-7 w-7 px-0"
              title="Ricarica issues"
              aria-label="Ricarica issues"
            >
              <RefreshCw size={12} />
            </button>
          )}
          <button
            onClick={toggle}
            disabled={loading || !canStart}
            className={cn(
              "btn h-7 gap-1.5 px-2.5",
              simMode
                ? "border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                : "btn-primary",
            )}
          >
            {loading ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : simMode ? (
              <>
                <Square size={11} className="fill-current" /> Stop
              </>
            ) : (
              <>
                <Play size={11} className="fill-current" /> Avvia
              </>
            )}
          </button>
        </div>
      </div>

      {/* Config */}
      <div className="shrink-0 border-b border-line px-3 py-2.5">
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-mut">
          Label GitHub
        </label>
        <input
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
          disabled={simMode}
          placeholder="sams"
          className="settings-input w-full"
        />
        <p className="mt-1 text-[10px] text-mut">
          Issue aperte con questa label vengono assegnate automaticamente agli agenti liberi
        </p>

        <label className="mt-3 flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={webhookAutoAssign}
            onChange={(e) => setWebhookAutoAssign(e.target.checked)}
            className="mt-0.5 accent-emerald-500"
          />
          <span className="text-[11px] leading-snug text-slate-300">
            Rispondi ai webhook GitHub
            <span className="mt-0.5 block text-[10px] text-mut">
              CI fallita o review richiesta → assegna in automatico un task contestuale a un
              agente libero. Se spento, l'evento compare solo nel log.
            </span>
          </span>
        </label>
      </div>

      {/* Not ready warning */}
      {!canStart && (
        <div className="shrink-0 border-b border-line px-3 py-2 text-[11px] text-amber-300">
          ⚠ Runtime non pronto — configura le chiavi nelle Impostazioni e avvia il provisioning
        </div>
      )}

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {simMode ? (
          <div className="p-2">
            {/* Stats */}
            <div className="mb-2 flex gap-3 px-1 text-[10px] text-mut">
              <span>
                <span className="font-medium text-slate-300">{available}</span> disponibili
              </span>
              <span>
                <span className="font-medium text-emerald-400">{inProgress}</span> in lavoro
              </span>
            </div>

            {simIssues.length === 0 ? (
              <div className="px-1 py-2 text-mut">
                Nessuna issue con label{" "}
                <code className="rounded bg-white/[0.06] px-1">{simLabel}</code> trovata nel
                repo configurato.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {simIssues.map((issue) => {
                  const claimer = issue.claimedBy
                    ? agents.find((a) => a.id === issue.claimedBy)
                    : null;
                  return (
                    <div
                      key={issue.number}
                      className={cn(
                        "rounded-md border px-2.5 py-2",
                        claimer
                          ? "border-brand/30 bg-brand/5"
                          : "border-line bg-white/[0.02]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-mut">#{issue.number}</span>{" "}
                          <span className="font-medium leading-snug text-slate-200">
                            {issue.title}
                          </span>
                        </div>
                        <a
                          href={issue.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-mut transition-colors hover:text-brand-soft"
                          aria-label={`Apri issue #${issue.number} su GitHub`}
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>

                      {claimer ? (
                        <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                          <span
                            className={`h-1.5 w-1.5 rounded-full bg-agent-${claimer.color}`}
                          />
                          <span className="text-brand-soft">in lavoro con {claimer.name}</span>
                        </div>
                      ) : (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {issue.labels.map((l) => (
                            <span
                              key={l}
                              className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-mut"
                            >
                              {l}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="px-3 py-4 leading-relaxed text-mut">
            <p className="mb-3 font-semibold text-slate-300">Come funziona:</p>
            <ol className="list-inside list-decimal space-y-1.5">
              <li>
                Crea issue GitHub con label{" "}
                <code className="rounded bg-white/[0.06] px-1">sams</code> (o un'altra a
                piacere)
              </li>
              <li>Avvia la simulazione — gli agenti liberi le prendono in automatico</li>
              <li>
                Ogni agente lavora in autonomia usando i suoi strumenti GitHub, apre una PR
                e poi passa alla prossima issue
              </li>
              <li>Fermala quando vuoi: il task in corso si conclude normalmente</li>
            </ol>
            <p className="mt-3 text-[10px]">
              Suggerimento: nelle impostazioni, abilita{" "}
              <em>Apri PR automaticamente</em> per vedere le PR comparire su GitHub in
              tempo reale.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
