import { useEffect, useRef, useState } from "react";
import { Check, FileText, ListOrdered, MousePointerClick, Plus, Send, Trash2, X as XIcon } from "lucide-react";
import { useSelectedAgent, useStore } from "../store/useStore";
import { AGENT_HEX, type AgentStatus } from "../types";
import { STATUS_META } from "../lib/meta";
import { ZONES } from "../data/world";
import { cn } from "../lib/utils";
import { approveChanges, assignRemote, backendEnabled, clearMemory, fetchMemory, rejectChanges, type MemoryEntry } from "../lib/backend";
import { TASK_CATEGORIES, TASK_TEMPLATES } from "../data/taskTemplates";
import { StagedFileDiff } from "./StagedFileDiff";

const STATUSES: AgentStatus[] = ["idle", "working", "review", "blocked", "done"];

const AGENT_ROLES = [
  { id: "Generalist", label: "Generalista", desc: "Scrive codice e contenuti senza istruzioni aggiuntive" },
  { id: "Revisore", label: "Revisore", desc: "Legge il codice e documenta osservazioni su Notion; non modifica file" },
  { id: "Tester", label: "Tester", desc: "Scrive file di test seguendo le convenzioni del repo" },
  { id: "Documentatore", label: "Documentatore", desc: "Aggiorna README, file .md e pagine Notion" },
  { id: "Architetto", label: "Architetto", desc: "Analizza la struttura e scrive documenti di piano" },
];

export function AgentInspector() {
  const agent = useSelectedAgent();
  const agents = useStore((s) => s.agents);
  const selectAgent = useStore((s) => s.selectAgent);
  const setStatus = useStore((s) => s.setStatus);
  const assignTask = useStore((s) => s.assignTask);
  const updateProgress = useStore((s) => s.updateProgress);
  const clearTask = useStore((s) => s.clearTask);
  const sendToZone = useStore((s) => s.sendToZone);
  const removeAgent = useStore((s) => s.removeAgent);
  const setRole = useStore((s) => s.setRole);
  const setInstructions = useStore((s) => s.setInstructions);
  const renameAgent = useStore((s) => s.renameAgent);
  const enqueueTask = useStore((s) => s.enqueueTask);
  const removeFromQueue = useStore((s) => s.removeFromQueue);
  const log = useStore((s) => s.log);

  const [title, setTitle] = useState("");
  const [branch, setBranch] = useState("");
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memoriesOpen, setMemoriesOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!agent?.id || !memoriesOpen) return;
    fetchMemory(agent.id).then(setMemories).catch(() => {});
  }, [agent?.id, memoriesOpen]);

  function toggleStep(i: number) {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

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
        <button
          title="Rimuovi agente"
          onClick={() => removeAgent(agent.id)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-rose-300/80 hover:bg-rose-500/15 hover:text-rose-300"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="chip bg-ink-700 text-slate-300">{agent.model}</span>
        <select
          value={agent.role}
          onChange={(e) => setRole(agent.id, e.target.value)}
          title="Ruolo agente — modella il system prompt"
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
      </div>

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
          <span className="text-[11px]" title={`Mood: ${agent.mood ?? "happy"}`}>
            {agent.mood === "happy" ? "😊"
              : agent.mood === "focused" ? "🎯"
              : agent.mood === "tired" ? "😴"
              : agent.mood === "proud" ? "🌟"
              : agent.mood === "frustrated" ? "😤"
              : "😊"}
          </span>
        </div>
      )}

      {/* inline rename */}
      <input
        value={agent.name}
        onChange={(e) => renameAgent(agent.id, e.target.value)}
        placeholder="Nome agente…"
        title="Clicca per rinominare"
        className="mt-2 w-full rounded-md border border-transparent bg-transparent px-2 py-0.5 text-[13px] font-medium text-slate-300 outline-none transition-colors hover:border-line focus:border-brand/50 focus:bg-ink-800"
      />

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
          <div className="mt-1 text-right text-[10px] text-mut">
            {agent.instructions.length}/1200
          </div>
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
            {memories.length === 0 ? (
              <p className="text-[11px] text-mut">Nessuna memoria salvata. L&apos;agente usa <code>remember</code> per salvare informazioni persistenti.</p>
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
                    clearMemory(agent.id).then(() => setMemories([])).catch(() => {});
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

      {/* diff approval panel */}
      {agent.status === "awaiting_approval" && (agent.pendingFiles?.length ?? 0) > 0 && (
        <div className="mt-3 rounded-lg border border-violet-500/30 bg-violet-500/5 p-2.5">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-violet-300">
            <FileText size={12} />
            {agent.pendingFiles!.length} {agent.pendingFiles!.length === 1 ? "file pronto" : "file pronti"} per il commit
          </div>
          <div className="mb-3 max-h-52 space-y-1.5 overflow-y-auto">
            {agent.pendingFiles!.map((f, i) => (
              <StagedFileDiff key={i} file={f} />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                approveChanges(agent.id).catch((err: Error) =>
                  log({ agentId: agent.id, agentName: agent.name, color: agent.color, level: "ERROR", message: `Approvazione: ${err.message}` }),
                );
              }}
              className="btn btn-primary flex-1"
            >
              <Check size={13} /> Approva e committa
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
                    {checkedSteps.size}/{agent.task.plan!.length} completati
                  </span>
                </div>
                <ol className="space-y-1">
                  {agent.task.plan!.map((step, i) => {
                    const done = checkedSteps.has(i);
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
                  className="h-full rounded-full bg-gradient-to-r from-brand to-brand-soft shadow-[0_0_8px_rgba(79,140,255,0.6)] transition-all"
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
                onClick={() => clearTask(agent.id)}
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
                <span className="min-w-0 flex-1 truncate text-[11px] text-slate-200">{qt.title}</span>
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
          <button
            disabled={!title.trim()}
            onClick={() => {
              const t = title.trim();
              const b = branch.trim();
              if (agent.task) {
                // agent busy → queue it
                enqueueTask(agent.id, { title: t, branch: b });
                log({ agentId: agent.id, agentName: agent.name, color: agent.color, level: "INFO", message: `In coda: ${t}` });
              } else {
                // agent idle → start immediately
                assignTask(agent.id, t, b);
                if (backendEnabled) {
                  assignRemote(agent.id, agent.name, t, b, agent.role, agent.instructions).catch((err: Error) =>
                    log({ agentId: agent.id, agentName: agent.name, color: agent.color, level: "ERROR", message: `Runtime: ${err.message}` }),
                  );
                }
              }
              setTitle("");
              setBranch("");
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

      {/* status quick set */}
      <div className="mt-3">
        <div className="mb-1.5 text-[11px] font-medium text-mut">Stato</div>
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

      {/* dispatch */}
      <div className="mt-3">
        <div className="mb-1.5 text-[11px] font-medium text-mut">Invia a una zona</div>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) sendToZone(agent.id, e.target.value);
            e.currentTarget.value = "";
          }}
          className="w-full rounded-md border border-line bg-ink-850 px-2 py-1.5 text-[12px] text-slate-200 outline-none focus:border-brand/50"
        >
          <option value="">Invia a…</option>
          {ZONES.map((z) => (
            <option key={z.id} value={z.id} className="bg-ink-800">
              {z.label} · {z.sublabel}
            </option>
          ))}
        </select>
      </div>
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
