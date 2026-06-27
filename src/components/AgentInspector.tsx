import { useRef, useState } from "react";
import { MousePointerClick, Send, Trash2 } from "lucide-react";
import { useSelectedAgent, useStore } from "../store/useStore";
import { AGENT_HEX, type AgentStatus } from "../types";
import { STATUS_META } from "../lib/meta";
import { ZONES } from "../data/world";
import { cn } from "../lib/utils";
import { assignRemote, backendEnabled } from "../lib/backend";
import { TASK_CATEGORIES, TASK_TEMPLATES } from "../data/taskTemplates";

const STATUSES: AgentStatus[] = ["idle", "working", "review", "blocked", "done"];

const AGENT_ROLES = [
  { id: "Generalist", label: "Generalist", desc: "Scrive codice e contenuti senza istruzioni aggiuntive" },
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
  const log = useStore((s) => s.log);

  const [title, setTitle] = useState("");
  const [branch, setBranch] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

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
          Select an agent in the scene, the minimap or the explorer to inspect and command it.
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
          title="Remove agent"
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
          title="Agent role — shapes the system prompt"
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

      {/* standing instructions */}
      <details className="mt-3 rounded-lg border border-line bg-ink-850/60">
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

      {/* task */}
      <div className="mt-3 rounded-lg border border-line bg-ink-850/60 p-2.5">
        {agent.task ? (
          <div>
            <Field label="Task" value={agent.task.title} />
            <Field label="Branch" mono value={agent.task.branch} />
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-mut">Progress</span>
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
                Clear task
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[11px] font-medium text-mut">Assign a task</div>
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
              placeholder="Task title…"
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
                assignTask(agent.id, t, b);
                if (backendEnabled) {
                  assignRemote(agent.id, agent.name, t, b, agent.role, agent.instructions).catch((err: Error) =>
                    log({
                      agentId: agent.id,
                      agentName: agent.name,
                      color: agent.color,
                      level: "ERROR",
                      message: `Runtime: ${err.message}`,
                    }),
                  );
                }
                setTitle("");
                setBranch("");
              }}
              className="btn btn-primary w-full"
            >
              <Send size={13} /> {backendEnabled ? "Assign task (live)" : "Assign task"}
            </button>
          </div>
        )}
      </div>

      {/* status quick set */}
      <div className="mt-3">
        <div className="mb-1.5 text-[11px] font-medium text-mut">Status</div>
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
        <div className="mb-1.5 text-[11px] font-medium text-mut">Dispatch to zone</div>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) sendToZone(agent.id, e.target.value);
            e.currentTarget.value = "";
          }}
          className="w-full rounded-md border border-line bg-ink-850 px-2 py-1.5 text-[12px] text-slate-200 outline-none focus:border-brand/50"
        >
          <option value="">Send to…</option>
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
