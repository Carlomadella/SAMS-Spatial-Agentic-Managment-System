import { useEffect, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  GitPullRequest,
  Play,
  Plus,
  Rocket,
  Settings2,
  X,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { WORKFLOW_DEFS } from "../data/seed";
import { AGENT_HEX, type Agent, type FileNode, type WorkflowDef } from "../types";
import { assignRemote, backendEnabled, fetchRepoTree } from "../lib/backend";
import { buildFileTree } from "../lib/fileTree";
import { metaRepo } from "../lib/metaAgent";
import { cn } from "../lib/utils";

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "task";
}
function makeBranch(agentName: string, title: string): string {
  return `sams/${agentName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}/${slugify(title)}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const STATUS_DOT: Record<string, string> = {
  idle: "bg-slate-500",
  working: "bg-brand animate-pulse-soft",
  review: "bg-amber-400",
  blocked: "bg-rose-500",
  done: "bg-emerald-400",
  awaiting_approval: "bg-violet-400 animate-pulse-soft",
};

const STATUS_LABEL: Record<string, string> = {
  idle: "inattivo",
  working: "in corso…",
  review: "in revisione",
  blocked: "bloccato",
  done: "completato",
  awaiting_approval: "in attesa…",
};

const BADGE_CLS: Record<string, string> = {
  M: "text-amber-400",
  U: "text-emerald-400",
  A: "text-emerald-400",
};

const WORKFLOW_ICON: Record<string, React.ElementType> = {
  BookOpen,
  GitPullRequest,
  Rocket,
};

function fileIcon(name: string) {
  if (name.endsWith(".flow")) return Rocket;
  if (name.endsWith(".yaml") || name.endsWith(".env") || name.endsWith(".spatial")) return FileCode2;
  return FileText;
}

// ---------------------------------------------------------------------------
// Agents section
// ---------------------------------------------------------------------------

function AgentRow({ agent, isSelected }: { agent: Agent; isSelected: boolean }) {
  const selectAgent = useStore((s) => s.selectAgent);

  return (
    <button
      onClick={() => selectAgent(agent.id)}
      className={cn(
        "group w-full rounded-md px-2 py-1.5 text-left transition-colors",
        isSelected ? "bg-brand/15 ring-1 ring-brand/30" : "hover:bg-ink-700/60",
      )}
    >
      <div className="flex items-center gap-2">
        {/* color dot */}
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/20"
          style={{ background: AGENT_HEX[agent.color] }}
        />
        {/* name */}
        <span
          className={cn(
            "flex-1 truncate text-[12px] font-medium",
            isSelected ? "text-white" : "text-slate-200",
          )}
        >
          {agent.name}
        </span>
        {/* status chip */}
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition-colors",
            agent.status === "idle"
              ? "text-slate-500"
              : agent.status === "working" || agent.status === "awaiting_approval"
                ? "bg-brand/15 text-brand-soft"
                : agent.status === "review"
                  ? "bg-amber-500/15 text-amber-300"
                  : agent.status === "blocked"
                    ? "bg-rose-500/15 text-rose-300"
                    : "bg-emerald-500/15 text-emerald-300",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[agent.status])} />
          {STATUS_LABEL[agent.status]}
        </span>
      </div>

      {/* task sub-row */}
      {agent.task && (
        <div className="mt-1 pl-[18px]">
          <p className="truncate text-[10px] text-mut">{agent.task.title}</p>
          {agent.task.progress > 0 && (
            <div className="mt-0.5 h-0.5 w-full overflow-hidden rounded-full bg-ink-700">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  agent.task.progress >= 100 ? "bg-emerald-400" : "bg-brand",
                )}
                style={{ width: `${agent.task.progress}%` }}
              />
            </div>
          )}
        </div>
      )}
    </button>
  );
}

function AgentsSection() {
  const agents = useStore((s) => s.agents);
  const selectedAgentId = useStore((s) => s.selectedAgentId);
  const addAgent = useStore((s) => s.addAgent);
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-2">
      {/* Header is a div (not a button) so the inner Spawn button is valid HTML.
          `group` enables the inner button's group-hover reveal. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
        className="group flex w-full cursor-pointer select-none items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-mut transition-colors hover:text-slate-300"
      >
        <span className="flex items-center gap-1.5">
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          Agenti
          <span className="rounded-full bg-ink-700 px-1.5 text-[9px]">{agents.length}</span>
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); addAgent(); }}
          title="Crea nuovo agente"
          aria-label="Crea nuovo agente"
          className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-ink-600 hover:text-white"
        >
          <Plus size={12} />
        </button>
      </div>

      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5 px-1">
          {agents.map((a) => (
            <AgentRow key={a.id} agent={a} isSelected={a.id === selectedAgentId} />
          ))}
          <button
            onClick={() => addAgent()}
            className="mt-0.5 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-mut transition-colors hover:bg-ink-700/60 hover:text-slate-300"
          >
            <Plus size={12} />
            Crea agente
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workflow runner
// ---------------------------------------------------------------------------

function WorkflowRunner({
  wf,
  onClose,
}: {
  wf: WorkflowDef;
  onClose: () => void;
}) {
  const agents = useStore((s) => s.agents);
  const assignTask = useStore((s) => s.assignTask);
  const backendOnline = useStore((s) => s.backendOnline);
  const runtimeReady = useStore((s) => s.runtimeReady);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(() => {
    const pref = agents.find((a) => a.role === wf.defaultRole && a.status === "idle");
    return (pref ?? agents.find((a) => a.status === "idle") ?? agents[0])?.id ?? "";
  });
  const [running, setRunning] = useState(false);

  const Icon = WORKFLOW_ICON[wf.icon] ?? Rocket;
  const agent = agents.find((a) => a.id === selectedAgentId);
  const canRun = !!agent && (agent.status === "idle" || !agent.task);

  async function run() {
    if (!agent) return;
    setRunning(true);
    const branch = makeBranch(agent.name, wf.taskTemplate);
    assignTask(agent.id, wf.taskTemplate, branch);
    if (backendEnabled && backendOnline && runtimeReady) {
      try {
        await assignRemote(agent.id, agent.name, wf.taskTemplate, branch, agent.role, agent.instructions, metaRepo(agent));
      } catch {
        /* local assign already happened */
      }
    }
    setRunning(false);
    onClose();
  }

  return (
    <div className="mx-1 mb-2 rounded-lg border border-brand/30 bg-brand/5 p-3">
      {/* header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand/20">
            <Icon size={14} className="text-brand-soft" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-white">{wf.name}</p>
            <p className="text-[10px] text-mut">{wf.name}.flow</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-mut transition-colors hover:text-slate-300"
          aria-label="Chiudi"
        >
          <X size={13} />
        </button>
      </div>

      {/* description */}
      <p className="mb-3 text-[11px] leading-relaxed text-slate-400">{wf.description}</p>

      {/* agent selector */}
      <div className="mb-3">
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-mut">Agente</label>
        <select
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
          className="w-full rounded-md border border-line bg-ink-850 px-2 py-1.5 text-[12px] text-slate-200 outline-none focus:border-brand/50"
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id} disabled={!!a.task && a.status !== "idle"}>
              {a.name} ({a.role}){a.status !== "idle" ? " — occupato" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* run button */}
      <button
        onClick={run}
        disabled={!canRun || running}
        className="btn btn-primary w-full gap-2 disabled:opacity-40"
      >
        <Play size={12} className="fill-current" />
        {running ? "Avvio…" : "Esegui workflow"}
      </button>

      {!canRun && agent && (
        <p className="mt-1.5 text-center text-[10px] text-amber-400">
          {agent.name} è occupato — scegli un agente idle
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workflows section
// ---------------------------------------------------------------------------

function WorkflowsSection() {
  const [open, setOpen] = useState(true);
  const [activeWfId, setActiveWfId] = useState<string | null>(null);

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-mut transition-colors hover:text-slate-300"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        Workflow
        <span className="rounded-full bg-ink-700 px-1.5 text-[9px]">{WORKFLOW_DEFS.length}</span>
      </button>

      {open && (
        <div className="mt-0.5 flex flex-col gap-1 px-1">
          {WORKFLOW_DEFS.map((wf) => {
            const Icon = WORKFLOW_ICON[wf.icon] ?? Rocket;
            const isActive = activeWfId === wf.id;

            return (
              <div key={wf.id}>
                <button
                  onClick={() => setActiveWfId(isActive ? null : wf.id)}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors",
                    isActive ? "bg-brand/10 text-white" : "text-slate-300 hover:bg-ink-700/60",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded",
                      isActive ? "bg-brand/25" : "bg-ink-700 group-hover:bg-ink-600",
                    )}
                  >
                    <Icon size={12} className={isActive ? "text-brand-soft" : "text-mut"} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium leading-tight">{wf.name}</p>
                    <p className="truncate text-[10px] text-mut">{wf.name.toLowerCase()}.flow</p>
                  </div>
                  <Play
                    size={12}
                    className={cn(
                      "shrink-0 transition-opacity",
                      isActive ? "text-brand-soft opacity-100" : "opacity-0 group-hover:opacity-60",
                    )}
                  />
                </button>

                {isActive && (
                  <WorkflowRunner wf={wf} onClose={() => setActiveWfId(null)} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic file tree (environments / configs / docs)
// ---------------------------------------------------------------------------

function FileRow({
  node,
  depth,
  expanded,
  toggle,
}: {
  node: FileNode;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
}) {
  const isFolder = node.kind === "folder";
  const isOpen = expanded.has(node.id);
  const Icon = isFolder ? (isOpen ? FolderOpen : Folder) : fileIcon(node.name);

  return (
    <>
      <button
        onClick={() => isFolder && toggle(node.id)}
        className="group flex w-full items-center gap-1 rounded px-1 py-[3px] text-left text-[12px] text-slate-400 transition-colors hover:bg-ink-700/50 hover:text-slate-300"
        style={{ paddingLeft: 8 + depth * 10 }}
      >
        {isFolder ? (
          isOpen ? (
            <ChevronDown size={11} className="shrink-0 text-mut" />
          ) : (
            <ChevronRight size={11} className="shrink-0 text-mut" />
          )
        ) : (
          <span className="w-[11px] shrink-0" />
        )}

        <Icon
          size={13}
          className={cn("shrink-0", isFolder ? "text-brand-soft/70" : "text-slate-500")}
        />
        <span className="flex-1 truncate">{node.name}</span>
        {node.badge && (
          <span className={cn("pr-1 text-[10px] font-semibold", BADGE_CLS[node.badge ?? "M"])}>
            {node.badge}
          </span>
        )}
      </button>

      {isFolder &&
        isOpen &&
        node.children?.map((child) => (
          <FileRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            toggle={toggle}
          />
        ))}
    </>
  );
}

function FilesSection() {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [branch, setBranch] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "disconnected" | "error">("loading");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // I file veri del repo di lavoro (via GitHub), non più un albero finto.
  useEffect(() => {
    let alive = true;
    fetchRepoTree().then((res) => {
      if (!alive) return;
      if (!res) return setStatus("error");
      setBranch(res.branch);
      if (!res.connected) return setStatus("disconnected");
      setTree(buildFileTree(res.entries));
      setTruncated(res.truncated);
      setStatus("ready");
    });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-mut">File</span>
        {status === "ready" && branch && (
          <span className="flex items-center gap-1 text-[9px] text-mut" title={`branch ${branch}`}>
            <GitBranch size={9} />
            {branch}
          </span>
        )}
      </div>
      <div className="px-1">
        {status === "loading" && <p className="px-2 py-1 text-[11px] text-mut">Carico i file dal repo…</p>}
        {status === "disconnected" && (
          <p className="px-2 py-1 text-[11px] leading-relaxed text-mut">
            Collega un repo GitHub nelle impostazioni per vedere i file del workspace.
          </p>
        )}
        {status === "error" && <p className="px-2 py-1 text-[11px] text-mut">Repo non raggiungibile.</p>}
        {status === "ready" && tree.length === 0 && <p className="px-2 py-1 text-[11px] text-mut">Nessun file nel repo.</p>}
        {status === "ready" &&
          tree.map((node) => (
            <FileRow key={node.id} node={node} depth={0} expanded={expanded} toggle={toggle} />
          ))}
        {truncated && <p className="px-2 pt-1 text-[9px] text-mut">Elenco troncato (repo grande).</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root Explorer
// ---------------------------------------------------------------------------

export function Explorer() {
  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-mut">Esplora risorse</span>
        <button
          title="Impostazioni area di lavoro"
          aria-label="Impostazioni area di lavoro"
          className="rounded p-0.5 text-mut transition-colors hover:bg-ink-700 hover:text-slate-300"
        >
          <Settings2 size={13} />
        </button>
      </div>

      {/* workspace root label */}
      <div className="shrink-0 px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <FolderOpen size={13} className="text-brand-soft" />
          <span className="text-[11px] font-semibold text-slate-300">SAMS-WORKSPACE</span>
        </div>
      </div>

      {/* scrollable tree */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <AgentsSection />
        <div className="mx-3 mb-2 border-t border-line/60" />
        <WorkflowsSection />
        <div className="mx-3 mb-2 border-t border-line/60" />
        <FilesSection />
      </div>
    </div>
  );
}
