import { useEffect, useRef, useState } from "react";
import type { RoomId } from "../lib/roomFor";
import { Check, Download, FileText, GitMerge, Play, ShieldCheck, ListOrdered, MousePointerClick, Plus, Send, Target, Trash2, X as XIcon } from "lucide-react";
import { useHouse, useSelectedAgent, useStore } from "../store/useStore";
import { AGENT_HEX, type AgentStatus } from "../types";
import { STATUS_META } from "../lib/meta";
import { hasEarnedXp, levelFromXp, XP_PER_TASK } from "../lib/skill";
import { affinityTier, bestFriend } from "../lib/relationships";
import { activeGoal, goalProgress } from "../lib/goals";
import { balanceOf, formatCoins } from "../lib/economy";
import { cn } from "../lib/utils";
import { approveChanges, assignRemote, backendEnabled, cancelRemote, clearMemory, fetchMemory, fetchPending, rejectChanges, type MemoryEntry } from "../lib/backend";
import { SAMS_REPO, META_IDEAS, isValidRepo, metaRepo, resolveTaskRepo, buildMetaTask } from "../lib/metaAgent";
import { AGENT_TEMPLATES, findTemplate, parseTemplate, serializeTemplate, templateFromAgent } from "../lib/agentTemplates";
import { hasUnfilledPlaceholders } from "../lib/validation";
import { canAssign, canDeleteAgents } from "../lib/roleUi";
import { useAssignBlock } from "../lib/assignGate";
import { planStepsDone } from "../lib/orchestration";
import { TASK_CATEGORIES, TASK_TEMPLATES } from "../data/taskTemplates";
import { StagedFileDiff } from "./StagedFileDiff";
import { TaskResultBox } from "./TaskResultBox";
import { AgentUsageBox, QuotaHint } from "./AgentUsage";

const STATUSES: AgentStatus[] = ["idle", "working", "review", "blocked", "done"];

/** Italian labels for the agent moods (shown in the energy tooltip). */
const MOOD_LABEL: Record<string, string> = {
  happy: "felice",
  focused: "concentrato",
  tired: "stanco",
  hungry: "affamato",
  proud: "orgoglioso",
  frustrated: "frustrato",
};

export const AGENT_ROLES = [ // stessi id di AGENT_ROLE_IDS in lib/agentRoles
  // Il ruolo è un'etichetta (serve al passaggio di lavoro "al Tester…"): cosa fa
  // davvero l'agente lo decidono le sue istruzioni permanenti.
  { id: "Generalist", label: "Generalista", desc: "Etichetta: cosa fa l'agente lo decidono le sue regole" },
  { id: "Revisore", label: "Revisore", desc: "Etichetta: gli altri agenti gli passano le revisioni; cosa fa lo decidono le sue regole" },
  { id: "Tester", label: "Tester", desc: "Etichetta: gli altri agenti gli passano i test; cosa fa lo decidono le sue regole" },
  { id: "Documentatore", label: "Documentatore", desc: "Etichetta: gli altri agenti gli passano la documentazione; cosa fa lo decidono le sue regole" },
  { id: "Architetto", label: "Architetto", desc: "Etichetta: gli altri agenti gli passano i piani; cosa fa lo decidono le sue regole" },
];

export function AgentInspector() {
  const agent = useSelectedAgent();
  const lastResult = useStore((s) => (agent ? s.results[agent.id] : undefined));
  const simMode = useStore((s) => s.simMode);
  const agents = useStore((s) => s.agents);
  const addAgent = useStore((s) => s.addAgent);
  const affinity = useStore((s) => s.affinity);
  const goals = useStore((s) => s.goals);
  const addGoal = useStore((s) => s.addGoal);
  const removeGoal = useStore((s) => s.removeGoal);
  const wallets = useStore((s) => s.wallets);
  const selectAgent = useStore((s) => s.selectAgent);
  const setStatus = useStore((s) => s.setStatus);
  const assignTask = useStore((s) => s.assignTask);
  const updateProgress = useStore((s) => s.updateProgress);
  const clearTask = useStore((s) => s.clearTask);
  const sendToZone = useStore((s) => s.sendToZone);
  const askRemoveAgent = useStore((s) => s.askRemoveAgent);
  const setRole = useStore((s) => s.setRole);
  const setInstructions = useStore((s) => s.setInstructions);
  const setRepo = useStore((s) => s.setRepo);
  const setSquad = useStore((s) => s.setSquad);
  const setMeta = useStore((s) => s.setMeta);
  const applyTemplateAction = useStore((s) => s.applyTemplate);
  const agentPresets = useStore((s) => s.agentPresets);
  const saveAgentPreset = useStore((s) => s.saveAgentPreset);
  const removeAgentPreset = useStore((s) => s.removeAgentPreset);
  const renameAgent = useStore((s) => s.renameAgent);
  const enqueueTask = useStore((s) => s.enqueueTask);
  const viewerRole = useStore((s) => s.viewerRole);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const block = useAssignBlock();
  const zones = useHouse().zones;
  const runtimeModel = useStore((s) => s.runtimeModel);
  const removeFromQueue = useStore((s) => s.removeFromQueue);
  const feedAgent = useStore((s) => s.feedAgent);
  const log = useStore((s) => s.log);

  const [title, setTitle] = useState("");
  const [branch, setBranch] = useState("");
  const [taskRepo, setTaskRepo] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalMilestone, setGoalMilestone] = useState(3);
  const [importJson, setImportJson] = useState("");
  const [importErr, setImportErr] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memoriesOpen, setMemoriesOpen] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!agent?.id || !memoriesOpen) return;
    setMemoryError(null);
    fetchMemory(agent.id)
      .then(setMemories)
      .catch((err: Error) => setMemoryError(`Impossibile caricare le memorie: ${err.message}`));
  }, [agent?.id, memoriesOpen]);

  function toggleStep(i: number) {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  // In attesa ma senza i dettagli (pagina ricaricata): li si chiede al server, così chi
  // guarda può sempre confermare o rifiutare e l'agente non resta bloccato in sala d'attesa.
  const setPendingWork = useStore((s) => s.setPendingWork);
  const openReview = useStore((s) => s.openReview);
  const missingPending =
    agent?.status === "awaiting_approval" && !(agent.pendingFiles?.length) && !agent.pendingMerge && !agent.pendingWorkflow;
  useEffect(() => {
    if (!agent?.id || !missingPending || !backendEnabled) return;
    let alive = true;
    void fetchPending(agent.id).then((w) => {
      if (alive && w) setPendingWork(agent.id, { pendingFiles: w.pendingFiles, pendingMerge: w.pendingMerge ?? undefined, pendingWorkflow: w.pendingWorkflow ?? undefined, mainGate: w.mainGate });
    });
    return () => { alive = false; };
  }, [agent?.id, missingPending, setPendingWork]);

  // Reset checked steps when the agent or task changes
  useEffect(() => { setCheckedSteps(new Set()); }, [agent?.id, agent?.task?.title]);

  function applyTemplate(id: string) {
    const tpl = TASK_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    setTitle(tpl.title);
    setBranch(tpl.branch ?? "");
    // focus the title and select the first {placeholder} for quick editing
    requestAnimationFrame(() => {
      const el = titleRef.current;
      if (!el) return;
      el.focus();
      const m = tpl.title.match(/\{[^}]+\}/);
      if (m && m.index != null) el.setSelectionRange(m.index, m.index + m[0].length);
      else el.setSelectionRange(tpl.title.length, tpl.title.length);
    });
  }

  if (!agent) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-mut">
        <MousePointerClick size={22} />
        <p className="text-[12px] leading-relaxed">
          Seleziona un agente nella scena, nella minimappa o nell&apos;esploratore per ispezionarlo e comandarlo.
        </p>
      </div>
    );
  }

  const meta = STATUS_META[agent.status];
  const doneSteps = planStepsDone(agent.task?.plan?.length ?? 0, checkedSteps, agent.status, agent.task?.progress ?? 0);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      {/* agent selector */}
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: AGENT_HEX[agent.color] }} />
        <select
          value={agent.id}
          onChange={(e) => selectAgent(e.target.value)}
          className="flex-1 rounded-md border border-line bg-ink-850 px-2 py-1 text-[13px] font-medium text-white outline-none focus:border-brand/50"
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id} className="bg-ink-800">
              {a.name}
            </option>
          ))}
        </select>
        {canDeleteAgents(viewerRole) && (
          <button
            title="Rimuovi agente"
            onClick={() => askRemoveAgent(agent.id)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-rose-300/80 hover:bg-rose-500/15 hover:text-rose-300"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {/* Il modello vero è quello del provider attivo: l'etichetta salvata sull'agente
            ("Claude Opus" per quelli di partenza) resta solo come ripiego senza runtime. */}
        <span className="chip bg-ink-700 text-slate-300" title="Modello usato dal runtime">
          {runtimeModel || agent.model}
        </span>
        <select
          value={agent.role}
          onChange={(e) => setRole(agent.id, e.target.value)}
          title="Ruolo agente: è solo un'etichetta. Cosa fa l'agente lo decidono le Istruzioni permanenti"
          className="chip cursor-pointer border border-line bg-ink-700 text-slate-300 outline-none focus:border-brand/50"
        >
          {AGENT_ROLES.map((r) => (
            <option key={r.id} value={r.id} className="bg-ink-800">
              {r.label}
            </option>
          ))}
        </select>
        <span className={cn("chip bg-ink-800", meta.text)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} /> {meta.label}
        </span>
        <button
          onClick={() => setMeta(agent.id, !agent.meta)}
          title="Meta-agente: i task lavorano sul repository di SAMS stesso (auto-miglioramento + PR)"
          className={cn(
            "chip cursor-pointer border",
            agent.meta
              ? "border-rose-400/50 bg-rose-500/15 text-rose-200"
              : "border-line bg-ink-700 text-slate-400 hover:text-slate-200",
          )}
        >
          🤯 Meta
        </button>
      </div>

      {agent.meta && (
        <div className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-2">
          <div className="text-[11px] font-semibold text-rose-200">Meta-agente — repo: SAMS</div>
          <p className="mt-0.5 text-[11px] text-rose-200/70">
            Ogni task di questo agente lavora su <code className="rounded bg-ink-800/60 px-1">{SAMS_REPO}</code> e propone migliorie al progetto.
          </p>
          <select
            value=""
            onChange={(e) => {
              const idea = META_IDEAS.find((i) => i.id === e.target.value);
              if (!idea) return;
              const { title: t, branch: b } = buildMetaTask(idea);
              setTitle(t);
              setBranch(b);
            }}
            className="mt-1.5 w-full cursor-pointer rounded-md border border-rose-400/30 bg-ink-800 px-2 py-1 text-[12px] text-slate-200 outline-none focus:border-rose-400/60"
          >
            <option value="" className="bg-ink-800">Proponi una miglioria a SAMS…</option>
            {META_IDEAS.map((i) => (
              <option key={i.id} value={i.id} className="bg-ink-800">{i.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* diff approval panel — e sala d'attesa: push/merge sul branch principale */}
      {agent.status === "awaiting_approval" && ((agent.pendingFiles?.length ?? 0) > 0 || agent.pendingMerge || agent.pendingWorkflow) && (
        <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-2.5" data-testid="pending-panel">
          {agent.mainGate && (
            <p className="mb-2 text-[11px] leading-relaxed text-rose-200">
              <strong>Sala d'attesa.</strong> Gli agenti non toccano mai il branch principale: {agent.name} aspetta
              che una persona confermi. Finché non decidi non può ricevere altri task.
            </p>
          )}
          {(agent.pendingFiles?.length ?? 0) > 0 && (
            <>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-rose-300">
                <FileText size={12} />
                {agent.pendingFiles!.length} {agent.pendingFiles!.length === 1 ? "file pronto" : "file pronti"} per il commit
                {agent.mainGate && agent.task?.branch ? ` su ${agent.task.branch}` : ""}
              </div>
              <div className="mb-3 max-h-52 space-y-1.5 overflow-y-auto">
                {agent.pendingFiles!.map((f, i) => (
                  <StagedFileDiff key={i} file={f} agentId={agent.id} />
                ))}
              </div>
            </>
          )}
          {agent.pendingMerge && (
            <div className="mb-3 text-[11px] text-rose-300">
              <div className="flex items-center gap-1.5 font-semibold">
                <GitMerge size={12} />
                Merge della PR #{agent.pendingMerge.prNumber} ({agent.pendingMerge.method})
              </div>
              {agent.pendingMerge.title && <div className="mt-0.5 text-slate-300">{agent.pendingMerge.title}</div>}
              {agent.pendingMerge.headRef && (
                <div className="mt-0.5 font-mono text-[10px] text-mut">
                  {agent.pendingMerge.headRef} → {agent.pendingMerge.baseRef} @ {agent.pendingMerge.headSha?.slice(0, 7)}
                </div>
              )}
              <div className="mt-0.5 text-[10px] text-mut">Vale solo per questo commit: se la PR cambia, il merge viene annullato.</div>
            </div>
          )}
          {agent.pendingWorkflow && (
            <div className="mb-3 text-[11px] text-rose-300" data-testid="pending-workflow">
              <div className="flex items-center gap-1.5 font-semibold">
                <Play size={12} />
                Workflow {agent.pendingWorkflow.workflow} su {agent.pendingWorkflow.ref}
              </div>
              <div className="mt-0.5 text-[10px] text-mut">Parte solo se approvi, dopo il commit dei file.</div>
            </div>
          )}
          <button
            onClick={() => openReview(agent.id)}
            className="btn mb-2 w-full"
          >
            <ShieldCheck size={13} /> Rileggi tutto nel Reparto revisioni
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => {
                approveChanges(agent.id).catch((err: Error) =>
                  log({ agentId: agent.id, agentName: agent.name, color: agent.color, level: "ERROR", message: `Approvazione: ${err.message}` }),
                );
              }}
              className="btn btn-primary flex-1"
            >
              <Check size={13} /> {agent.mainGate ? "Conferma" : "Approva e committa"}
            </button>
            <button
              onClick={() => rejectChanges(agent.id)}
              className="btn flex-1 border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
            >
              <XIcon size={13} /> Rifiuta
            </button>
          </div>
        </div>
      )}

      {/* risultato completo dell'ultimo task (collaudo 21/11, punto 1) */}
      {lastResult && <TaskResultBox result={lastResult} />}

      {/* task + queue */}
      <div className="mt-3 rounded-lg border border-line bg-ink-850/60 p-2.5">
        {/* current task progress */}
        {agent.task && (
          <div>
            <Field label="Task" value={agent.task.title} />
            <Field label="Branch" mono value={agent.task.branch} />

            {/* step-by-step plan from announce_plan — clickable to mark steps done */}
            {(agent.task.plan?.length ?? 0) > 0 && (
              <div className="mt-2 rounded-md border border-brand/20 bg-brand/5 px-2 py-1.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-brand/70">Piano</span>
                  <span className="text-[10px] text-mut">
                    {doneSteps.size}/{agent.task.plan!.length} completati
                  </span>
                </div>
                <ol className="space-y-1">
                  {agent.task.plan!.map((step, i) => {
                    const done = doneSteps.has(i);
                    return (
                      <li
                        key={i}
                        role="button"
                        tabIndex={0}
                        aria-pressed={done}
                        onClick={() => toggleStep(i)}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleStep(i)}
                        className={cn(
                          "flex cursor-pointer items-start gap-1.5 rounded px-1 py-0.5 text-[11px] transition-colors hover:bg-brand/10",
                          done ? "text-mut" : "text-slate-300",
                        )}
                      >
                        <span className={cn(
                          "mt-0.5 shrink-0 font-mono text-[10px]",
                          done ? "text-emerald-500" : "text-brand/60",
                        )}>
                          {done ? "✓" : `${i + 1}.`}
                        </span>
                        <span className={cn("leading-relaxed", done && "line-through opacity-60")}>
                          {step}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-mut">Avanzamento</span>
                <span className="font-mono text-slate-200">{agent.task.progress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-brand-soft shadow-[0_0_8px_rgb(var(--c-accent)/0.6)] transition-all"
                  style={{ width: `${agent.task.progress}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={agent.task.progress}
                onChange={(e) => updateProgress(agent.id, Number(e.target.value))}
                className="mt-2 w-full accent-brand"
              />
              <button
                onClick={() => {
                  // Sul runtime il task gira davvero: lo si ferma anche lì, non solo nella pagina.
                  if (backendEnabled && agent.status === "working") {
                    cancelRemote(agent.id).catch((err: Error) =>
                      log({ agentId: agent.id, agentName: agent.name, color: agent.color, level: "ERROR", message: `Annullamento: ${err.message}` }),
                    );
                  }
                  clearTask(agent.id);
                }}
                className="mt-1 text-[11px] text-mut hover:text-rose-300"
              >
                Annulla task
              </button>
            </div>
          </div>
        )}

        {/* queue list */}
        {(agent.taskQueue?.length ?? 0) > 0 && (
          <div className={cn("space-y-1", agent.task && "mt-3 border-t border-line pt-2.5")}>
            <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-mut">
              <ListOrdered size={11} /> In coda ({agent.taskQueue.length})
            </div>
            {agent.taskQueue.map((qt, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-md bg-ink-800 px-2 py-1">
                {qt.urgent && (
                  <span title="Task urgente — salta la coda" className="shrink-0 text-[11px] text-slate-300">⚡</span>
                )}
                <span className="min-w-0 flex-1 truncate text-[11px] text-slate-200">{qt.title}</span>
                {qt.repo && (
                  <span title={`Repo del task: ${qt.repo}`} className="shrink-0 truncate rounded bg-ink-700 px-1 font-mono text-[9px] text-slate-300">⑂ {qt.repo}</span>
                )}
                <button
                  onClick={() => removeFromQueue(agent.id, i)}
                  title="Rimuovi dalla coda"
                  className="shrink-0 text-mut hover:text-rose-300"
                >
                  <XIcon size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* assign / enqueue form */}
        <div className={cn("space-y-2", agent.task && "mt-3 border-t border-line pt-2.5")}>
          <div className="text-[11px] font-medium text-mut">
            {agent.task ? "Metti in coda il prossimo task" : "Assegna un task"}
          </div>
          {canAssign(viewerRole) && block && (
            <div role="status" className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] leading-snug text-rose-200">
              {block.message}
              {block.section && (
                <button
                  onClick={() => setSettingsOpen(true, block.section!)}
                  className="mt-1 block font-semibold text-white underline underline-offset-2 hover:text-rose-100"
                >
                  {block.section === "github" ? "Apri ⚙ → Il tuo GitHub" : "Apri ⚙ → GitHub del server"}
                </button>
              )}
            </div>
          )}
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) applyTemplate(e.target.value);
              e.currentTarget.value = "";
            }}
            className="w-full rounded-md border border-line bg-ink-850 px-2 py-1.5 text-[12px] text-slate-200 outline-none focus:border-brand/50"
          >
            <option value="">Parti da un template…</option>
            {TASK_CATEGORIES.map((cat) => (
              <optgroup key={cat} label={cat} className="bg-ink-800">
                {TASK_TEMPLATES.filter((t) => t.category === cat).map((t) => (
                  <option key={t.id} value={t.id} className="bg-ink-800">
                    {t.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titolo del task…"
            className="w-full rounded-md border border-line bg-ink-800 px-2 py-1.5 text-[12px] text-slate-200 outline-none placeholder:text-mut focus:border-brand/50"
          />
          <input
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="feature/branch"
            className="w-full rounded-md border border-line bg-ink-800 px-2 py-1.5 font-mono text-[12px] text-slate-200 outline-none placeholder:text-mut focus:border-brand/50"
          />
          <input
            value={taskRepo}
            onChange={(e) => setTaskRepo(e.target.value)}
            placeholder={`repo del task (opzionale) — vuoto = ${metaRepo(agent) ?? "repo globale"}`}
            title="Indirizza SOLO questo task a un repository diverso (owner/repo). Vuoto = usa il repo dell'agente."
            className={cn(
              "w-full rounded-md border bg-ink-800 px-2 py-1.5 font-mono text-[12px] text-slate-200 outline-none placeholder:text-mut/70 focus:border-brand/50",
              taskRepo.trim() && !isValidRepo(taskRepo) ? "border-rose-500/60" : "border-line",
            )}
          />
          {taskRepo.trim() && !isValidRepo(taskRepo) && (
            <p className="text-[11px] leading-snug text-rose-400">Formato repo non valido: usa <code className="rounded bg-ink-700 px-1">owner/repo</code>.</p>
          )}
          {(hasUnfilledPlaceholders(title) || hasUnfilledPlaceholders(branch)) && (
            <p className="text-[11px] leading-snug text-slate-400">
              Compila i segnaposto tra parentesi graffe (es. <code className="rounded bg-ink-700 px-1">{"{argomento}"}</code>,{" "}
              <code className="rounded bg-ink-700 px-1">{"{pagina}"}</code>) prima di assegnare il task.
            </p>
          )}
          {agent.task && (
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
                className="accent-slate-500"
              />
              <span>⚡ Urgente — salta la coda</span>
            </label>
          )}
          {backendEnabled && <QuotaHint agentId={agent.id} />}
          {!canAssign(viewerRole) && (
            <p className="text-[11px] leading-snug text-slate-400">
              👁 Sei in <strong>sola lettura</strong>: puoi osservare il mondo ma non avviare lavoro.
            </p>
          )}
          <button
            disabled={!canAssign(viewerRole) || !!block || !title.trim() || hasUnfilledPlaceholders(title) || hasUnfilledPlaceholders(branch) || (!!taskRepo.trim() && !isValidRepo(taskRepo))}
            onClick={() => {
              const t = title.trim();
              const b = branch.trim();
              const repoOverride = taskRepo.trim() || undefined;
              if (agent.task) {
                // agent busy → queue it (carrying the per-task repo + urgency)
                enqueueTask(agent.id, { title: t, branch: b, repo: repoOverride, urgent, environment: useStore.getState().environment });
                log({ agentId: agent.id, agentName: agent.name, color: agent.color, level: "INFO", message: `In coda${urgent ? " (urgente)" : ""}: ${t}` });
              } else {
                // agent idle → start immediately
                assignTask(agent.id, t, b);
                if (backendEnabled) {
                  assignRemote(agent.id, agent.name, t, b, agent.role, agent.instructions, resolveTaskRepo(agent, repoOverride)).catch((err: Error) =>
                    log({ agentId: agent.id, agentName: agent.name, color: agent.color, level: "ERROR", message: `Runtime: ${err.message}` }),
                  );
                }
              }
              setTitle("");
              setBranch("");
              setTaskRepo("");
              setUrgent(false);
            }}
            className="btn btn-primary w-full"
          >
            {agent.task
              ? <><Plus size={13} /> Aggiungi alla coda</>
              : <><Send size={13} /> {backendEnabled ? "Assegna task (live)" : "Assegna task"}</>
            }
          </button>
        </div>
      </div>

      {/* status quick set — collaudo 21/11, punto 6.3 (opzione C): solo con la Live Sim
          attiva, dove serve. Con agenti veri confondeva: si poteva segnare «Completato» un
          task non finito. Fuori dalla simulazione resta «Annulla task». */}
      {simMode && (
      <div className="mt-3" data-testid="status-quick-set">
        <div className="mb-1.5 text-[11px] font-medium text-mut">Stato (simulazione)</div>
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(agent.id, s)}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] capitalize transition-colors",
                agent.status === s
                  ? "border-brand/50 bg-brand/15 text-white"
                  : "border-line bg-ink-850 text-mut hover:text-slate-200",
              )}
            >
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* dispatch */}
      <div className="mt-3">
        <div className="mb-1.5 text-[11px] font-medium text-mut">Invia a una zona</div>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) sendToZone(agent.id, e.target.value as RoomId);
            e.currentTarget.value = "";
          }}
          className="w-full rounded-md border border-line bg-ink-850 px-2 py-1.5 text-[12px] text-slate-200 outline-none focus:border-brand/50"
        >
          <option value="">Invia a…</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id} className="bg-ink-800">
              {z.label} · {z.sublabel}
            </option>
          ))}
        </select>
      </div>

      <details className="mt-3 rounded-lg border border-line bg-ink-850/60">
        <summary className="flex cursor-pointer select-none items-center justify-between px-2.5 py-2 text-[11px] font-semibold text-slate-300 hover:text-white">
          <span>Vita e progressi</span>
          <span className="text-[10px] font-normal opacity-60">energia, livello, gettoni</span>
        </summary>
        <div className="px-2.5 pb-2.5">
          {/* energy + mood */}
          {agent.energy != null && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] text-mut w-12 shrink-0">Energia</span>
              <div className="relative flex-1 h-1.5 rounded-full bg-ink-700 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                  style={{
                    width: `${agent.energy}%`,
                    background: agent.energy > 60 ? "#22c55e" : agent.energy > 30 ? "#eab308" : "#ef4444",
                  }}
                />
              </div>
              <span className="text-[10px] text-mut w-7 text-right shrink-0">{agent.energy}%</span>
              <span className="text-[11px]" title={`Umore: ${MOOD_LABEL[agent.mood ?? "happy"]}`}>
                {agent.mood === "happy" ? "😊"
                  : agent.mood === "focused" ? "🎯"
                  : agent.mood === "tired" ? "😴"
                  : agent.mood === "hungry" ? "🤤"
                  : agent.mood === "proud" ? "🌟"
                  : agent.mood === "frustrated" ? "😤"
                  : "😊"}
              </span>
            </div>
          )}

          {/* hunger — grows over time; assigning a task (or a snack) feeds the agent */}
          {agent.hunger != null && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[10px] text-mut w-12 shrink-0">Fame</span>
              <div className="relative flex-1 h-1.5 rounded-full bg-ink-700 overflow-hidden" title={agent.hunger >= 80 ? "Affamato" : agent.hunger >= 50 ? "Un po' affamato" : "Sazio"}>
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                  style={{
                    width: `${agent.hunger}%`,
                    background: agent.hunger >= 70 ? "#ef4444" : agent.hunger >= 40 ? "#eab308" : "#22c55e",
                  }}
                />
              </div>
              <span className="text-[10px] text-mut w-7 text-right shrink-0">{agent.hunger}%</span>
              <button
                onClick={() => feedAgent(agent.id, 35)}
                title="Dai uno spuntino"
                className="text-[11px] leading-none transition-transform hover:scale-110 active:scale-95"
              >
                🍽️
              </button>
            </div>
          )}

          {/* level / rank — earned by completing tasks */}
          {!hasEarnedXp(agent.xp) && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[10px] text-mut w-12 shrink-0">Livello</span>
              <span className="text-[10px] text-mut">Nessun task completato: il primo vale {XP_PER_TASK} XP</span>
            </div>
          )}
          {hasEarnedXp(agent.xp) && (() => {
            const lv = levelFromXp(agent.xp);
            return (
              <div className="mt-1.5 flex items-center gap-2" title={`${lv.xpForNext != null ? `${lv.xpIntoLevel}/${lv.xpForNext} XP al prossimo livello` : "Livello massimo"}`}>
                <span className="text-[10px] text-mut w-12 shrink-0">Livello</span>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-ink-700 px-1.5 py-0.5 text-[9px] font-semibold text-slate-300">
                  ⭐ Lv{lv.level}
                </span>
                <div className="relative flex-1 h-1.5 rounded-full bg-ink-700 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-slate-400 transition-all duration-700"
                    style={{ width: `${Math.round(lv.progress * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-mut shrink-0">{lv.name}</span>
              </div>
            );
          })()}

          {/* token economy — coins earned by completing work (more for a PR/result) */}
          <div className="mt-1.5 flex items-center gap-2" title="Gettoni guadagnati completando task (bonus se producono una PR/risultato)">
            <span className="text-[10px] text-mut w-12 shrink-0">Gettoni</span>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-ink-700 px-1.5 py-0.5 text-[9px] font-semibold text-slate-300">
              🪙 {formatCoins(balanceOf(wallets, agent.id))}
            </span>
          </div>

          {/* relationships — the closest bond built by collaborating (relay + chatter) */}
          {(() => {
            const bf = bestFriend(affinity, agent.id, agents.map((a) => a.id));
            const friend = bf && agents.find((a) => a.id === bf.id);
            if (!bf || !friend) return null;
            return (
              <div
                className="mt-1.5 flex items-center gap-2"
                title={`Affinità ${bf.score} — costruita collaborando (relay_task)`}
              >
                <span className="text-[10px] text-mut w-12 shrink-0">Legame</span>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: AGENT_HEX[friend.color] }} />
                <span className="min-w-0 flex-1 truncate text-[11px] text-slate-300">{friend.name}</span>
                <span className="shrink-0 rounded-full bg-ink-700 px-1.5 py-0.5 text-[9px] font-semibold text-rose-300">
                  💚 {affinityTier(bf.score)}
                </span>
              </div>
            );
          })()}

          {/* long-term goal (project) — a milestone of N completed tasks that
              persists across sessions; each completed task advances it */}
          <details className="mt-2 rounded-lg border border-line bg-ink-850/60">
            <summary className="flex cursor-pointer select-none items-center justify-between px-2.5 py-2 text-[11px] font-medium text-mut hover:text-slate-200">
              <span className="inline-flex items-center gap-1.5"><Target size={11} /> Progetto</span>
              <span className="text-[10px] opacity-60">obiettivo a lungo termine</span>
            </summary>
            <div className="px-2.5 pb-2.5">
              {(() => {
                const goal = activeGoal(goals, agent.id);
                if (goal) {
                  return (
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-200" title={goal.title}>{goal.title}</span>
                        <span className="shrink-0 font-mono text-[10px] text-mut">{Math.min(goal.completed, goal.milestone)}/{goal.milestone}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-700"
                          style={{ width: `${Math.round(goalProgress(goal) * 100)}%` }}
                        />
                      </div>
                      <button onClick={() => removeGoal(goal.id)} className="mt-1.5 text-[10px] text-mut hover:text-rose-300">
                        Abbandona obiettivo
                      </button>
                    </div>
                  );
                }
                return (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-mut">Nessun progetto. Ogni task completato dall&apos;agente avvicina la milestone.</p>
                    <input
                      value={goalTitle}
                      onChange={(e) => setGoalTitle(e.target.value)}
                      placeholder="Es. Rifattorizza il modulo auth"
                      className="w-full rounded-md border border-line bg-ink-800 px-2 py-1.5 text-[12px] text-slate-200 outline-none placeholder:text-mut focus:border-brand/50"
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-mut">Task</label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={goalMilestone}
                        onChange={(e) => setGoalMilestone(Number(e.target.value))}
                        className="w-16 rounded-md border border-line bg-ink-800 px-2 py-1 text-[12px] text-slate-200 outline-none focus:border-brand/50"
                      />
                      <button
                        disabled={!goalTitle.trim()}
                        onClick={() => { addGoal(agent.id, goalTitle, goalMilestone); setGoalTitle(""); setGoalMilestone(3); }}
                        className="btn btn-primary ml-auto"
                      >
                        Crea
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </details>
        </div>
      </details>

      <details className="mt-3 rounded-lg border border-line bg-ink-850/60">
        <summary className="flex cursor-pointer select-none items-center justify-between px-2.5 py-2 text-[11px] font-semibold text-slate-300 hover:text-white">
          <span>Configurazione</span>
          <span className="text-[10px] font-normal opacity-60">istruzioni, repo, memorie</span>
        </summary>
        <div className="px-2.5 pb-2.5">
          {/* inline rename */}
          <input
            value={agent.name}
            onChange={(e) => renameAgent(agent.id, e.target.value)}
            placeholder="Nome agente…"
            title="Clicca per rinominare"
            className="mt-2 w-full rounded-md border border-transparent bg-transparent px-2 py-0.5 text-[13px] font-medium text-slate-300 outline-none transition-colors hover:border-line focus:border-brand/50 focus:bg-ink-800"
          />

          {/* template, esporta, salva preset */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <select
              value=""
              onChange={(e) => {
                const t = AGENT_TEMPLATES.find((x) => x.id === e.target.value);
                if (!t) return;
                applyTemplateAction(agent.id, t);
                log({ agentId: agent.id, agentName: agent.name, color: agent.color, level: "INFO", message: `Template applicato: ${t.emoji} ${t.name}` });
              }}
              title="Applica un template (ruolo + modello + istruzioni)"
              className="chip cursor-pointer border border-line bg-ink-700 text-slate-300 outline-none focus:border-brand/50"
            >
              <option value="" className="bg-ink-800">📦 Template…</option>
              {AGENT_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id} className="bg-ink-800">{t.emoji} {t.name}</option>
              ))}
            </select>
            <button
              onClick={async () => {
                const json = serializeTemplate(templateFromAgent(agent, agent.name));
                try {
                  await navigator.clipboard.writeText(json);
                  log({ agentId: agent.id, agentName: agent.name, color: agent.color, level: "SUCCESS", message: "Template copiato negli appunti (JSON)" });
                } catch {
                  log({ agentId: agent.id, agentName: agent.name, color: agent.color, level: "WARN", message: "Copia non riuscita — appunti non disponibili" });
                }
              }}
              title="Esporta la configurazione di questo agente come template JSON condivisibile"
              className="chip cursor-pointer border border-line bg-ink-700 text-slate-400 hover:text-slate-200"
            >
              ⤓ Esporta
            </button>
            <button
              onClick={() => {
                const name = window.prompt("Nome del preset:", agent.role || agent.name);
                if (name == null) return;
                saveAgentPreset(agent.id, name);
                log({ agentId: agent.id, agentName: agent.name, color: agent.color, level: "SUCCESS", message: `Preset salvato: ${name.trim() || "senza nome"}` });
              }}
              title="Salva ruolo + modello + istruzioni correnti come preset riutilizzabile"
              className="chip cursor-pointer border border-line bg-ink-700 text-slate-400 hover:text-slate-200"
            >
              💾 Salva preset
            </button>
          </div>

          {/* preset salvati dall'utente — click per applicare, ✕ per rimuovere */}
          {agentPresets.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-mut">I miei preset</span>
              {agentPresets.map((p) => (
                <span
                  key={p.id}
                  className="chip group inline-flex items-center gap-1 border border-line bg-ink-700 text-slate-300"
                >
                  <button
                    onClick={() => {
                      applyTemplateAction(agent.id, p);
                      log({ agentId: agent.id, agentName: agent.name, color: agent.color, level: "INFO", message: `Preset applicato: ${p.emoji} ${p.name}` });
                    }}
                    title={`Applica: ${p.role} · ${p.model}`}
                    className="cursor-pointer hover:text-white"
                  >
                    {p.emoji} {p.name}
                  </button>
                  <button
                    onClick={() => removeAgentPreset(p.id)}
                    title="Rimuovi preset"
                    className="cursor-pointer text-mut hover:text-rose-400"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* import a shared template (JSON) — reuses the pure parseTemplate */}
          <details className="mt-2 rounded-lg border border-line bg-ink-850/60">
            <summary className="flex cursor-pointer select-none items-center justify-between px-2.5 py-2 text-[11px] font-medium text-mut hover:text-slate-200">
              <span className="inline-flex items-center gap-1.5"><Download size={11} /> Importa template</span>
              <span className="text-[10px] opacity-60">incolla un JSON</span>
            </summary>
            <div className="px-2.5 pb-2.5">
              <textarea
                value={importJson}
                onChange={(e) => { setImportJson(e.target.value); setImportErr(false); }}
                placeholder={'{"name":"…","role":"Tester","model":"Claude Sonnet","instructions":"…"}'}
                rows={4}
                className="w-full resize-y rounded-md border border-line bg-ink-800 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-slate-200 outline-none placeholder:text-mut/60 focus:border-brand/50"
              />
              {importErr && (
                <p className="mt-1 text-[11px] text-rose-400">JSON non valido: servono almeno <code>role</code>, <code>model</code> e <code>instructions</code>.</p>
              )}
              <div className="mt-1.5 flex gap-2">
                <button
                  disabled={!importJson.trim()}
                  onClick={() => {
                    const tpl = parseTemplate(importJson);
                    if (!tpl) { setImportErr(true); return; }
                    applyTemplateAction(agent.id, tpl);
                    setImportJson("");
                    log({ agentId: agent.id, agentName: agent.name, color: agent.color, level: "INFO", message: `Template importato applicato: ${tpl.emoji} ${tpl.name}` });
                  }}
                  className="btn btn-primary flex-1"
                >
                  Applica a questo
                </button>
                <button
                  disabled={!importJson.trim()}
                  onClick={() => {
                    const tpl = parseTemplate(importJson);
                    if (!tpl) { setImportErr(true); return; }
                    const id = addAgent();
                    applyTemplateAction(id, tpl);
                    selectAgent(id);
                    setImportJson("");
                    log({ agentId: id, agentName: tpl.name, color: null, level: "INFO", message: `Nuovo agente da template: ${tpl.emoji} ${tpl.name}` });
                  }}
                  className="btn flex-1"
                >
                  Crea nuovo agente
                </button>
              </div>
            </div>
          </details>

          {/* standing instructions */}
          <details className="mt-2 rounded-lg border border-line bg-ink-850/60">
            <summary className="flex cursor-pointer select-none items-center justify-between px-2.5 py-2 text-[11px] font-medium text-mut hover:text-slate-200">
              <span>Istruzioni permanenti{agent.instructions.trim() ? " ●" : ""}</span>
              <span className="text-[10px] opacity-60">sempre incluse nel prompt</span>
            </summary>
            <div className="px-2.5 pb-2.5">
              <textarea
                value={agent.instructions}
                onChange={(e) => setInstructions(agent.id, e.target.value)}
                placeholder={"Es: Scrivi sempre in TypeScript strict.\nUsa funzioni pure, evita classi.\nCommenta solo ciò che non è ovvio."}
                rows={4}
                maxLength={1200}
                className="w-full resize-y rounded-md border border-line bg-ink-800 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-slate-200 outline-none placeholder:text-mut/60 focus:border-brand/50"
              />
              <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-mut">
                {(() => {
                  // torna alle regole del preimpostato da cui è nato l'agente (se le ha cambiate)
                  const origin = findTemplate(agent.presetId, agentPresets);
                  if (!origin || origin.instructions === agent.instructions) return <span />;
                  return (
                    <button
                      onClick={() => {
                        setInstructions(agent.id, origin.instructions);
                        log({ agentId: agent.id, agentName: agent.name, color: agent.color, level: "INFO", message: `Regole ripristinate: ${origin.emoji} ${origin.name}` });
                      }}
                      title="Rimetti le regole originali del preimpostato (le tue modifiche si perdono)"
                      className="cursor-pointer text-slate-400 hover:text-slate-200"
                    >
                      ↺ Regole di «{origin.name}»
                    </button>
                  );
                })()}
                <span>{agent.instructions.length}/1200</span>
              </div>
            </div>
          </details>

          {/* richieste di oggi e tetto giornaliero (idea 1) */}
          {backendEnabled && <AgentUsageBox agentId={agent.id} />}

          {/* squadra: il relay preferisce i compagni di squadra del mittente */}
          <label className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-ink-850/60 px-2.5 py-2">
            <span className="shrink-0 text-[11px] font-medium text-mut">Squadra</span>
            <input
              value={agent.squad ?? ""}
              onChange={(e) => setSquad(agent.id, e.target.value)}
              list="sams-squads"
              maxLength={40}
              placeholder="nessuna"
              title="Quando passa il lavoro a un ruolo, l'agente sceglie prima un compagno libero della stessa squadra."
              className="min-w-0 flex-1 rounded-md border border-line bg-ink-800 px-2 py-1 text-[12px] text-slate-200 outline-none placeholder:text-mut/60 focus:border-brand/50"
            />
            <datalist id="sams-squads">
              {[...new Set(agents.map((a) => a.squad?.trim()).filter((s): s is string => !!s))].map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>

          {/* per-agent target repository override (multi-repo) */}
          <details className="mt-2 rounded-lg border border-line bg-ink-850/60">
            <summary className="flex cursor-pointer select-none items-center justify-between px-2.5 py-2 text-[11px] font-medium text-mut hover:text-slate-200">
              <span>Repository{agent.repo?.trim() ? " ●" : ""}</span>
              <span className="text-[10px] opacity-60">override per questo agente</span>
            </summary>
            <div className="px-2.5 pb-2.5">
              <input
                value={agent.repo ?? ""}
                onChange={(e) => setRepo(agent.id, e.target.value)}
                placeholder={agent.meta ? SAMS_REPO : "owner/repo — vuoto = repo globale"}
                spellCheck={false}
                className={cn(
                  "w-full rounded-md border bg-ink-800 px-2 py-1.5 font-mono text-[11px] text-slate-200 outline-none placeholder:text-mut/60 focus:border-brand/50",
                  agent.repo?.trim() && !isValidRepo(agent.repo) ? "border-rose-500/60" : "border-line",
                )}
              />
              <p className="mt-1 text-[10px] text-mut">
                {agent.repo?.trim()
                  ? isValidRepo(agent.repo)
                    ? `I task di questo agente lavorano su ${agent.repo.trim()}.`
                    : "Formato non valido — usa owner/repo."
                  : agent.meta
                    ? "Vuoto: i task meta lavorano sul repo di SAMS."
                    : "Vuoto: usa il repository globale del runtime."}
              </p>
            </div>
          </details>

          {/* agent memories */}
          {backendEnabled && (
            <details
              className="mt-2 rounded-lg border border-line bg-ink-850/60"
              onToggle={(e) => setMemoriesOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary className="flex cursor-pointer select-none items-center justify-between px-2.5 py-2 text-[11px] font-medium text-mut hover:text-slate-200">
                <span>Memorie di progetto{memories.length > 0 ? ` (${memories.length})` : ""}</span>
                <span className="text-[10px] opacity-60">salvate con remember</span>
              </summary>
              <div className="px-2.5 pb-2.5">
                {memoryError && (
                  <p role="alert" className="mb-1.5 text-[11px] text-rose-300">
                    {memoryError}
                  </p>
                )}
                {memories.length === 0 ? (
                  memoryError ? null : (
                  <p className="text-[11px] text-mut">Nessuna memoria salvata. L&apos;agente usa <code>remember</code> per salvare informazioni persistenti.</p>
                  )
                ) : (
                  <div className="space-y-1.5">
                    {memories.map((m) => (
                      <div key={m.key} className="rounded border border-line bg-ink-800 px-2 py-1.5">
                        <div className="mb-0.5 text-[10px] font-semibold text-brand/80">{m.key}</div>
                        <p className="text-[11px] text-slate-300">{m.value}</p>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        if (!agent) return;
                        clearMemory(agent.id)
                          .then(() => setMemories([]))
                          .catch((err: Error) => setMemoryError(`Cancellazione non riuscita: ${err.message}`));
                      }}
                      className="mt-1 text-[10px] text-mut hover:text-rose-300"
                    >
                      Cancella tutte le memorie
                    </button>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </details>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="shrink-0 text-[11px] text-mut">{label}</span>
      <span className={cn("truncate text-right text-[12px] text-slate-200", mono && "font-mono")}>
        {value}
      </span>
    </div>
  );
}
