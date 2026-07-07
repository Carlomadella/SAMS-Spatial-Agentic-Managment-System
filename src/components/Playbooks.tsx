import { Play, Plus, Users, X } from "lucide-react";
import { useState } from "react";
import { assignRemote, backendEnabled } from "../lib/backend";
import {
  BUILTIN_PLAYBOOKS,
  currentStage,
  expandStageTitle,
  playbookSummary,
  runLabel,
  runProgress,
  type CollabStage,
  type Playbook,
} from "../lib/collaboration";
import { metaRepo } from "../lib/metaAgent";
import { findRelayTarget } from "../lib/orchestration";
import { useStore } from "../store/useStore";
import { cn } from "../lib/utils";

/** Ogni riga "ruolo: titolo" diventa uno stadio; le righe vuote sono ignorate. */
function parseStages(text: string): CollabStage[] {
  return text
    .split("\n")
    .map((line) => {
      const i = line.indexOf(":");
      if (i < 0) return null;
      const role = line.slice(0, i).trim();
      const title = line.slice(i + 1).trim();
      if (!role || !title) return null;
      return { role, title };
    })
    .filter((s): s is CollabStage => s !== null);
}

/**
 * Editor dei "Protocolli di collaborazione" (tavoli): pipeline ordinate di stadi
 * ruolo→task con hand-off espliciti. Vive nel pannello Live Sim, accanto alle
 * reazioni a catena. Avviare un playbook assegna il primo stadio e lascia che il
 * `PlaybookBridge` passi la staffetta stadio dopo stadio al completamento.
 */
export function Playbooks() {
  const playbooks = useStore((s) => s.playbooks);
  const runs = useStore((s) => s.playbookRuns);
  const agents = useStore((s) => s.agents);
  const addPlaybook = useStore((s) => s.addPlaybook);
  const removePlaybook = useStore((s) => s.removePlaybook);
  const startPlaybook = useStore((s) => s.startPlaybook);
  const removePlaybookRun = useStore((s) => s.removePlaybookRun);
  const assignTask = useStore((s) => s.assignTask);
  const log = useStore((s) => s.log);
  const pushToast = useStore((s) => s.pushToast);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [branch, setBranch] = useState("");
  const [stagesText, setStagesText] = useState("");

  const stages = parseStages(stagesText);
  const canAdd = name.trim() !== "" && stages.length > 0;

  /** Precompila il form da un modello predefinito (l'utente lo può poi adattare). */
  function prefill(t: Omit<Playbook, "id">) {
    setName(t.name);
    setGoal(t.goal);
    setBranch(t.branch);
    setStagesText(t.stages.map((s) => `${s.role}: ${s.title}`).join("\n"));
    setAdding(true);
  }

  const activeRuns = runs.filter((r) => !r.done);

  function submit() {
    if (!canAdd) return;
    addPlaybook({ name: name.trim(), goal: goal.trim(), branch: branch.trim(), stages });
    setName("");
    setGoal("");
    setBranch("");
    setStagesText("");
    setAdding(false);
  }

  /** Avvia un playbook e assegna subito il primo stadio (riusa il percorso relay). */
  function launch(id: string) {
    const run = startPlaybook(id);
    if (!run) return;
    const stage = currentStage(run);
    if (!stage) {
      pushToast("INFO", `Playbook "${run.name}" senza stadi`);
      return;
    }
    const target = findRelayTarget(agents, stage.role);
    if (!target) {
      pushToast("WARN", `Nessun agente per lo stadio "${stage.role}"`);
      removePlaybookRun(run.id);
      return;
    }
    const title = expandStageTitle(stage, run.goal);
    const b = run.branch.trim() || "main";
    if (target.task) {
      useStore.getState().enqueueTask(target.id, { title, branch: b });
    } else {
      assignTask(target.id, title, b);
      if (backendEnabled) {
        assignRemote(target.id, target.name, title, b, target.role, target.instructions, metaRepo(target)).catch(
          (err: Error) =>
            log({ agentId: target.id, agentName: target.name, color: target.color, level: "ERROR", message: `Runtime: ${err.message}` }),
        );
      }
    }
    log({ agentId: target.id, agentName: target.name, color: target.color, level: "INFO", message: `🤝 Tavolo "${run.name}" avviato → ${title}` });
    pushToast("SUCCESS", `🤝 Tavolo "${run.name}" avviato`);
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
          <Users size={12} /> Tavoli di collaborazione
          {playbooks.length > 0 && <span className="text-mut">· {playbooks.length}</span>}
        </span>
        <button
          onClick={() => setAdding((v) => !v)}
          className="btn h-6 gap-1 px-1.5 text-[10px]"
          title="Aggiungi protocollo"
        >
          <Plus size={11} /> Tavolo
        </button>
      </div>
      <p className="mt-0.5 text-[10px] text-mut">
        Una pipeline ordinata di stadi ruolo→task: ogni completamento passa la staffetta al ruolo successivo.
      </p>

      {/* Run in corso */}
      {activeRuns.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {activeRuns.map((r) => {
            const stage = currentStage(r);
            return (
              <li key={r.id} className="rounded-md border border-brand/30 bg-brand/5 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] text-slate-200">{runLabel(r)}</span>
                  <button
                    onClick={() => removePlaybookRun(r.id)}
                    className="shrink-0 text-mut transition-colors hover:text-rose-400"
                    title="Abbandona il tavolo"
                    aria-label="Abbandona il tavolo"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded bg-white/[0.06]">
                  <div className="h-full rounded bg-brand" style={{ width: `${Math.round(runProgress(r) * 100)}%` }} />
                </div>
                {stage && <div className="mt-1 truncate text-[10px] text-mut">↳ {stage.role}: {expandStageTitle(stage, r.goal)}</div>}
                {(r.contributors?.length ?? 0) > 0 && (
                  <div className="mt-0.5 truncate text-[10px] text-mut">🤝 {r.contributors!.join(", ")}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Elenco protocolli */}
      {playbooks.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {playbooks.map((p) => (
            <li key={p.id} className="flex items-start gap-2 rounded-md border border-line bg-white/[0.02] px-2 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] text-slate-200">{playbookSummary(p)}</div>
                <div className="truncate text-[10px] text-mut">{p.stages.map((s) => s.role).join(" → ")}</div>
              </div>
              <button
                onClick={() => launch(p.id)}
                className="btn h-6 shrink-0 gap-1 px-1.5 text-[10px]"
                title="Avvia il tavolo"
              >
                <Play size={10} className="fill-current" /> Avvia
              </button>
              <button
                onClick={() => removePlaybook(p.id)}
                className="mt-0.5 shrink-0 text-mut transition-colors hover:text-rose-400"
                title="Rimuovi protocollo"
                aria-label="Rimuovi protocollo"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Modelli predefiniti — un click per precompilare il form */}
      {adding && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-mut">Modelli:</span>
          {BUILTIN_PLAYBOOKS.map((t) => (
            <button
              key={t.name}
              onClick={() => prefill(t)}
              className="btn h-6 px-1.5 text-[10px]"
              title={`Precompila da «${t.name}»`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* Form */}
      {adding && (
        <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-line bg-white/[0.02] p-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome del tavolo (es. Rilascio feature)"
            className="settings-input w-full text-[11px]"
          />
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Obiettivo condiviso ({goal} negli stadi)"
            className="settings-input w-full text-[11px]"
          />
          <textarea
            value={stagesText}
            onChange={(e) => setStagesText(e.target.value)}
            placeholder={"Uno stadio per riga — ruolo: titolo\ndev: Implementa {goal}\nreviewer: Rivedi {goal}\nqa: Testa {goal}"}
            rows={4}
            className="settings-input w-full resize-y font-mono text-[11px]"
          />
          <input
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="Branch (facoltativo, default main)"
            className="settings-input w-full text-[11px]"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-mut">{stages.length} stadi validi</span>
            <div className="flex gap-1.5">
              <button onClick={() => setAdding(false)} className="btn h-6 px-2 text-[10px]">
                Annulla
              </button>
              <button
                onClick={submit}
                disabled={!canAdd}
                className={cn("btn btn-primary h-6 px-2 text-[10px]")}
              >
                Aggiungi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
