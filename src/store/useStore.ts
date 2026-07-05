import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  AGENT_COLORS,
  type ActivityView,
  type Agent,
  type AgentColor,
  type AgentMood,
  type AgentStatus,
  type BottomTab,
  type EnvironmentName,
  type Handoff,
  type LogEvent,
  type LogLevel,
  type PendingFile,
  type QueuedTask,
  type SimIssue,
  type TaskRecord,
  type Toast,
  type Vec2,
} from "../types";
import { SEED_AGENTS, seedEvents } from "../data/seed";
import { clampToRoom, SPAWN_POINT, ZONE_BY_ID, zoneForTitle } from "../data/world";
import { clamp, uid } from "../lib/utils";
import { XP_PER_TASK } from "../lib/skill";
import { applyTemplate, type AgentTemplate } from "../lib/agentTemplates";
import { bumpAffinity as bumpAffinityMap, type AffinityMap } from "../lib/relationships";
import { advanceGoal as advanceGoalList, type Goal } from "../lib/goals";
import { earnCoins as earnCoinsMap, type Wallets } from "../lib/economy";
import type { ChainRule } from "../lib/chains";

const STATUS_LEVEL: Record<AgentStatus, LogLevel> = {
  idle: "IDLE",
  working: "INFO",
  review: "WARN",
  blocked: "ERROR",
  done: "SUCCESS",
  awaiting_approval: "WARN",
};

interface State {
  // --- domain ---
  agents: Agent[];
  events: LogEvent[];
  tasks: TaskRecord[];
  environment: EnvironmentName;
  selectedAgentId: string | null;

  // --- ui ---
  activity: ActivityView;
  bottomTab: BottomTab;
  commandOpen: boolean;
  settingsOpen: boolean;
  gardenOpen: boolean;
  theme: "dark" | "light";
  leftOpen: boolean;
  rightOpen: boolean;
  bottomOpen: boolean;
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;

  /** whether the optional managed-agents runtime is connected */
  backendOnline: boolean;
  /** whether the runtime has its keys set (ready to run tasks) */
  runtimeReady: boolean;
  /** Live Sim: agents pick GitHub issues automatically when enabled */
  simMode: boolean;
  /** GitHub label filter for Live Sim (default "sams") */
  simLabel: string;
  /** Current issues fetched from GitHub for the Live Sim */
  simIssues: SimIssue[];
  /** cumulative Gemini tokens used across tasks this workspace */
  tokensUsed: number;
  /** transient on-screen notifications */
  toasts: Toast[];

  // --- actions: agents ---
  addAgent: (color?: AgentColor) => string;
  removeAgent: (id: string) => void;
  selectAgent: (id: string | null) => void;
  setRole: (id: string, role: string) => void;
  setInstructions: (id: string, instructions: string) => void;
  setMeta: (id: string, meta: boolean) => void;
  applyTemplate: (id: string, t: AgentTemplate) => void;
  moveAgent: (id: string, target: Vec2) => void;
  arriveAgent: (id: string) => void;
  sendToZone: (id: string, zoneId: string) => void;
  setStatus: (id: string, status: AgentStatus) => void;
  assignTask: (id: string, title: string, branch: string) => void;
  updateProgress: (id: string, progress: number) => void;
  clearTask: (id: string) => void;
  /** Increase every agent's hunger over time (driven by HungerBridge). */
  growHunger: (amount: number) => void;
  /** Reduce a single agent's hunger (e.g. a manual "snack"). */
  feedAgent: (id: string, amount: number) => void;
  renameAgent: (id: string, name: string) => void;
  enqueueTask: (id: string, task: QueuedTask) => void;
  shiftQueue: (id: string) => void;
  removeFromQueue: (id: string, index: number) => void;
  setPendingFiles: (id: string, files: PendingFile[]) => void;
  clearPendingFiles: (id: string) => void;
  pendingRelays: Array<{ target: string; title: string; branch: string; context: string; fromName: string; fromId: string }>;
  pushRelay: (r: { target: string; title: string; branch: string; context: string; fromName: string; fromId: string }) => void;
  shiftRelay: () => void;
  /** Incoming-webhook "wakes": contextual tasks to assign to a free agent. */
  pendingWakes: Array<{ title: string; branch?: string; reason: string }>;
  pushWake: (w: { title: string; branch?: string; reason: string }) => void;
  shiftWake: () => void;
  /** Opt-in: assign incoming-webhook "wakes" to a free agent automatically. */
  webhookAutoAssign: boolean;
  setWebhookAutoAssign: (v: boolean) => void;
  /** Opt-in: idle meta-agents propose SAMS improvements on their own. */
  metaProactive: boolean;
  setMetaProactive: (v: boolean) => void;
  /** Short-lived handoff arcs drawn in the 3D scene. */
  handoffs: Handoff[];
  addHandoff: (fromId: string, toId: string) => void;
  /** Pairwise affinity built up by collaboration (relay handoffs + chatter). */
  affinity: AffinityMap;
  bumpAffinity: (a: string, b: string, delta?: number) => void;
  /** Long-term goals ("projects"): a milestone of N completed tasks per agent. */
  goals: Goal[];
  addGoal: (agentId: string, title: string, milestone: number) => void;
  advanceAgentGoal: (agentId: string, by?: number) => void;
  removeGoal: (id: string) => void;
  /** Token economy: per-agent "coin" balances, earned by completing work. */
  wallets: Wallets;
  earnCoins: (agentId: string, amount: number) => void;
  /** Reazioni a catena: regole dichiarative "task completato → nuovo task". */
  chains: ChainRule[];
  addChain: (rule: Omit<ChainRule, "id">) => void;
  updateChain: (id: string, patch: Partial<Omit<ChainRule, "id">>) => void;
  removeChain: (id: string) => void;
  toggleChain: (id: string) => void;

  // --- actions: world / log ---
  log: (e: Omit<LogEvent, "id" | "ts">) => void;
  clearEvents: () => void;
  clearTasks: () => void;
  setEnvironment: (env: EnvironmentName) => void;
  resetWorld: () => void;

  // --- actions: ui ---
  setActivity: (a: ActivityView) => void;
  setBottomTab: (t: BottomTab) => void;
  setCommandOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setGardenOpen: (open: boolean) => void;
  toggleTheme: () => void;
  setLeftOpen: (open: boolean) => void;
  setRightOpen: (open: boolean) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  toggleBottom: () => void;
  toggleFocus: () => void;
  setLeftWidth: (w: number) => void;
  setRightWidth: (w: number) => void;
  setBottomHeight: (h: number) => void;

  // --- actions: runtime (managed agents) ---
  setBackendOnline: (online: boolean) => void;
  setRuntimeReady: (ready: boolean) => void;
  setSimMode: (on: boolean) => void;
  setSimLabel: (label: string) => void;
  setSimIssues: (issues: SimIssue[]) => void;
  pushToast: (level: LogLevel, message: string) => void;
  dismissToast: (id: string) => void;
  applyRemote: (e: {
    agentId: string;
    agentName?: string;
    status?: AgentStatus;
    progress?: number;
    level?: LogLevel;
    message?: string;
    tokens?: number;
    pendingFiles?: PendingFile[];
    relayTo?: { target: string; title: string; branch: string; context: string };
    plan?: string[];
    wake?: { title: string; branch?: string; reason: string };
  }) => void;
}

function nextColor(agents: Agent[]): AgentColor {
  const counts = new Map<AgentColor, number>();
  for (const c of AGENT_COLORS) counts.set(c, 0);
  for (const a of agents) counts.set(a.color, (counts.get(a.color) ?? 0) + 1);
  // pick the least-used color (ties resolved by palette order)
  let best: AgentColor = AGENT_COLORS[0];
  let bestCount = Infinity;
  for (const c of AGENT_COLORS) {
    const n = counts.get(c) ?? 0;
    if (n < bestCount) {
      best = c;
      bestCount = n;
    }
  }
  return best;
}

function uniqueName(agents: Agent[], color: AgentColor): string {
  const base = `${color}-agent`;
  const taken = new Set(agents.map((a) => a.name));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

/** Compute mood from status, energy and hunger — outcome signals take priority. */
function moodFor(status: AgentStatus, energy: number, hunger: number, prevMood: AgentMood): AgentMood {
  if (status === "blocked") return "frustrated";
  if (status === "done" || status === "review") return "proud";
  if (hunger >= 80) return "hungry"; // starving has its own mood, distinct from tired
  if (status === "idle") return energy >= 70 ? "happy" : "focused";
  if (energy < 30) return "tired"; // low energy = worn out
  if (status === "working" || status === "awaiting_approval") return "focused";
  return prevMood;
}

function patchLatestTask(
  tasks: TaskRecord[],
  agentId: string,
  patch: Partial<TaskRecord>,
): TaskRecord[] {
  for (let i = tasks.length - 1; i >= 0; i--) {
    if (tasks[i].agentId === agentId) {
      const next = tasks.slice();
      next[i] = { ...next[i], ...patch };
      return next;
    }
  }
  return tasks;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
  agents: SEED_AGENTS.map((a) => ({ ...a })),
  events: seedEvents(),
  tasks: [],
  environment: "staging",
  selectedAgentId: null,

  activity: "explorer",
  bottomTab: "eventlog",
  commandOpen: false,
  settingsOpen: false,
  gardenOpen: false,
  theme:
    typeof localStorage !== "undefined" && localStorage.getItem("sams.theme") === "light"
      ? "light"
      : "dark",
  leftOpen: true,
  rightOpen: true,
  bottomOpen: true,
  leftWidth: 256,
  rightWidth: 296,
  bottomHeight: 248,
  backendOnline: false,
  runtimeReady: false,
  simMode: false,
  simLabel: "sams",
  simIssues: [],
  tokensUsed: 0,
  toasts: [],
  pendingRelays: [],
  pendingWakes: [],
  webhookAutoAssign: false,
  metaProactive: false,
  handoffs: [],
  affinity: {},
  goals: [],
  wallets: {},
  chains: [],

  log: (e) =>
    set((s) => ({
      events: [...s.events, { ...e, id: uid("evt"), ts: Date.now() }].slice(-300),
    })),

  addAgent: (color) => {
    const { agents, log } = get();
    const c = color ?? nextColor(agents);
    const name = uniqueName(agents, c);
    const id = uid("agent");
    const agent: Agent = {
      id,
      name,
      color: c,
      model: "Claude Sonnet",
      role: "Generalist",
      instructions: "",
      status: "idle",
      position: [...SPAWN_POINT] as Vec2,
      target: null,
      task: null,
      taskQueue: [],
      energy: 100,
      hunger: 0,
      mood: "happy",
      xp: 0,
    };
    set((s) => ({ agents: [...s.agents, agent], selectedAgentId: id }));
    log({ agentId: id, agentName: name, color: c, level: "INFO", message: "Agente creato nell'area di lavoro" });
    return id;
  },

  removeAgent: (id) => {
    const a = get().agents.find((x) => x.id === id);
    set((s) => ({
      agents: s.agents.filter((x) => x.id !== id),
      selectedAgentId: s.selectedAgentId === id ? null : s.selectedAgentId,
    }));
    if (a) get().log({ agentId: null, agentName: a.name, color: a.color, level: "WARN", message: "Agente rimosso dall'area di lavoro" });
  },

  selectAgent: (id) => set({ selectedAgentId: id }),

  setRole: (id, role) =>
    set((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, role } : a)) })),

  setInstructions: (id, instructions) =>
    set((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, instructions } : a)) })),

  setMeta: (id, meta) =>
    set((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, meta } : a)) })),

  applyTemplate: (id, t) =>
    set((s) => ({ agents: s.agents.map((a) => (a.id === id ? applyTemplate(a, t) : a)) })),

  moveAgent: (id, target) =>
    set((s) => ({
      agents: s.agents.map((a) =>
        a.id === id ? { ...a, target: clampToRoom(target) } : a,
      ),
    })),

  arriveAgent: (id) =>
    set((s) => ({
      agents: s.agents.map((a) =>
        a.id === id && a.target ? { ...a, position: a.target, target: null } : a,
      ),
    })),

  sendToZone: (id, zoneId) => {
    const zone = ZONE_BY_ID[zoneId];
    const a = get().agents.find((x) => x.id === id);
    if (!zone || !a) return;
    get().moveAgent(id, zone.position);
    get().log({ agentId: id, agentName: a.name, color: a.color, level: "INFO", message: `In viaggio verso ${zone.label} · ${zone.sublabel}` });
  },

  setStatus: (id, status) => {
    const a = get().agents.find((x) => x.id === id);
    set((s) => ({
      agents: s.agents.map((x) => {
        if (x.id !== id) return x;
        const energy = status === "idle" ? Math.min(100, x.energy + 15) : x.energy;
        return { ...x, status, energy, mood: moodFor(status, energy, x.hunger, x.mood) };
      }),
    }));
    if (a) {
      const msg: Record<AgentStatus, string> = {
        idle: "Ora inattivo · nessun task",
        working: "Lavoro ripreso",
        review: "In attesa di revisione",
        blocked: "Bloccato · richiede attenzione",
        done: "Task segnato come completato",
        awaiting_approval: "In attesa di approvazione",
      };
      get().log({ agentId: id, agentName: a.name, color: a.color, level: STATUS_LEVEL[status], message: msg[status] });
    }
    // When explicitly marked done, clear the task after a short visual pause.
    // Guard on the agent STILL being "done": if it was reassigned within the
    // window the timeout must not wipe the fresh task.
    if (status === "done") {
      setTimeout(() => {
        const agent = get().agents.find((x) => x.id === id);
        if (agent?.status === "done" && agent.task) get().clearTask(id);
      }, 1500);
    }
  },

  assignTask: (id, title, branch) => {
    const a = get().agents.find((x) => x.id === id);
    if (!a) return;
    const rec: TaskRecord = {
      id: uid("task"),
      agentId: id,
      agentName: a.name,
      color: a.color,
      title,
      branch: branch || "main",
      status: "working",
      progress: 0,
      createdAt: Date.now(),
    };
    set((s) => ({
      agents: s.agents.map((x) => {
        if (x.id !== id) return x;
        // a fresh task feeds the agent (a need à la The Sims): keep them busy to keep them fed
        const hunger = Math.max(0, x.hunger - 45);
        return {
          ...x,
          status: "working",
          task: { title, branch: branch || "main", progress: 0 },
          hunger,
          mood: moodFor("working", x.energy, hunger, x.mood),
        };
      }),
      tasks: [...s.tasks, rec].slice(-100),
    }));
    // walk to a fitting zone so work visibly "happens" somewhere
    const zone = ZONE_BY_ID[zoneForTitle(title)];
    if (zone) get().moveAgent(id, zone.position);
    get().log({ agentId: id, agentName: a.name, color: a.color, level: "INFO", message: `Task avviato: ${title}` });
  },

  updateProgress: (id, progress) => {
    const p = clamp(Math.round(progress), 0, 100);
    const a = get().agents.find((x) => x.id === id);
    if (!a || !a.task) return;
    const willComplete = p >= 100 && a.task.progress < 100;
    // Drain 1 energy point for every 7% of progress — long tasks tire the agent.
    const energyDrain = Math.max(0, Math.floor((p - a.task.progress) / 7));
    set((s) => ({
      agents: s.agents.map((x) => {
        if (x.id !== id || !x.task) return x;
        const newEnergy = Math.max(0, x.energy - energyDrain);
        const newStatus = p >= 100 ? "done" as const : x.status;
        const newMood = moodFor(newStatus, newEnergy, x.hunger, x.mood);
        const completed = p >= 100 && x.task.progress < 100;
        const xp = completed ? x.xp + XP_PER_TASK : x.xp;
        return { ...x, task: { ...x.task, progress: p }, status: newStatus, energy: newEnergy, mood: newMood, xp };
      }),
      tasks: patchLatestTask(s.tasks, id, { progress: p, ...(p >= 100 ? { status: "done" as const } : {}) }),
    }));
    if (willComplete) {
      get().log({ agentId: id, agentName: a.name, color: a.color, level: "SUCCESS", message: `Task completato: ${a.task.title}` });
      setTimeout(() => {
        const agent = get().agents.find((x) => x.id === id);
        if (agent?.status === "done" && agent.task) get().clearTask(id);
      }, 1500);
    }
  },

  clearTask: (id) => {
    const a = get().agents.find((x) => x.id === id);
    set((s) => ({
      agents: s.agents.map((x) => {
        if (x.id !== id) return x;
        const energy = Math.min(100, x.energy + 15);
        return { ...x, task: null, status: "idle", energy, mood: moodFor("idle", energy, x.hunger, x.mood) };
      }),
    }));
    if (a) get().log({ agentId: id, agentName: a.name, color: a.color, level: "IDLE", message: "Task annullato · ora inattivo" });
  },

  growHunger: (amount) =>
    set((s) => ({
      agents: s.agents.map((x) => {
        const hunger = clamp(x.hunger + amount, 0, 100);
        return { ...x, hunger, mood: moodFor(x.status, x.energy, hunger, x.mood) };
      }),
    })),

  feedAgent: (id, amount) =>
    set((s) => ({
      agents: s.agents.map((x) => {
        if (x.id !== id) return x;
        const hunger = clamp(x.hunger - amount, 0, 100);
        return { ...x, hunger, mood: moodFor(x.status, x.energy, hunger, x.mood) };
      }),
    })),

  renameAgent: (id, name) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, name: name || a.name } : a)),
    })),

  enqueueTask: (id, task) =>
    set((s) => ({
      agents: s.agents.map((a) =>
        a.id === id ? { ...a, taskQueue: [...(a.taskQueue ?? []), task] } : a,
      ),
    })),

  shiftQueue: (id) =>
    set((s) => ({
      agents: s.agents.map((a) =>
        a.id === id ? { ...a, taskQueue: (a.taskQueue ?? []).slice(1) } : a,
      ),
    })),

  removeFromQueue: (id, index) =>
    set((s) => ({
      agents: s.agents.map((a) =>
        a.id === id
          ? { ...a, taskQueue: (a.taskQueue ?? []).filter((_, i) => i !== index) }
          : a,
      ),
    })),

  setPendingFiles: (id, files) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, pendingFiles: files } : a)),
    })),

  clearPendingFiles: (id) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, pendingFiles: undefined } : a)),
    })),

  pushRelay: (r) => set((s) => ({ pendingRelays: [...s.pendingRelays, r] })),
  shiftRelay: () => set((s) => ({ pendingRelays: s.pendingRelays.slice(1) })),

  pushWake: (w) => set((s) => ({ pendingWakes: [...s.pendingWakes, w] })),
  shiftWake: () => set((s) => ({ pendingWakes: s.pendingWakes.slice(1) })),
  setWebhookAutoAssign: (v) => set({ webhookAutoAssign: v }),
  setMetaProactive: (v) => set({ metaProactive: v }),
  addHandoff: (fromId, toId) =>
    set((s) => ({
      handoffs: [
        ...s.handoffs.filter((h) => Date.now() - h.ts < 6000),
        { id: uid("ho"), fromId, toId, ts: Date.now() },
      ].slice(-8),
    })),
  bumpAffinity: (a, b, delta = 1) => set((s) => ({ affinity: bumpAffinityMap(s.affinity, a, b, delta) })),
  addGoal: (agentId, title, milestone) =>
    set((s) => ({
      goals: [
        ...s.goals,
        {
          id: uid("goal"),
          agentId,
          title: title.trim(),
          milestone: Math.max(1, Math.round(milestone)),
          completed: 0,
          createdAt: Date.now(),
          done: false,
        },
      ],
    })),
  advanceAgentGoal: (agentId, by = 1) => set((s) => ({ goals: advanceGoalList(s.goals, agentId, by) })),
  removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
  earnCoins: (agentId, amount) => set((s) => ({ wallets: earnCoinsMap(s.wallets, agentId, amount) })),
  addChain: (rule) => set((s) => ({ chains: [...s.chains, { ...rule, id: uid("chain") }] })),
  updateChain: (id, patch) =>
    set((s) => ({ chains: s.chains.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
  removeChain: (id) => set((s) => ({ chains: s.chains.filter((c) => c.id !== id) })),
  toggleChain: (id) =>
    set((s) => ({ chains: s.chains.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)) })),

  clearEvents: () => set({ events: [] }),
  clearTasks: () => set({ tasks: [] }),

  setEnvironment: (env) => {
    set({ environment: env });
    get().log({ agentId: null, agentName: "sistema", color: null, level: "INFO", message: `Ambiente cambiato → ${env}` });
  },

  resetWorld: () =>
    set({
      agents: SEED_AGENTS.map((a) => ({ ...a })),
      events: seedEvents(),
      selectedAgentId: null,
      environment: "staging",
    }),

  setActivity: (a) => set({ activity: a }),
  setBottomTab: (t) => set({ bottomTab: t, bottomOpen: true }),
  setCommandOpen: (open) => set({ commandOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setGardenOpen: (open) => set({ gardenOpen: open }),
  toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
  setLeftOpen: (open) => set({ leftOpen: open }),
  setRightOpen: (open) => set({ rightOpen: open }),
  toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
  toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
  toggleBottom: () => set((s) => ({ bottomOpen: !s.bottomOpen })),
  toggleFocus: () =>
    set((s) => {
      const anyOpen = s.leftOpen || s.rightOpen || s.bottomOpen;
      return { leftOpen: !anyOpen, rightOpen: !anyOpen, bottomOpen: !anyOpen };
    }),
  setLeftWidth: (w) => set({ leftWidth: clamp(w, 200, 520) }),
  setRightWidth: (w) => set({ rightWidth: clamp(w, 220, 560) }),
  setBottomHeight: (h) => set({ bottomHeight: clamp(h, 140, 560) }),

  setBackendOnline: (online) => set({ backendOnline: online }),
  setRuntimeReady: (ready) => set({ runtimeReady: ready }),
  setSimMode: (on) => set({ simMode: on }),
  setSimLabel: (label) => set({ simLabel: label }),
  setSimIssues: (issues) => set({ simIssues: issues }),

  pushToast: (level, message) => {
    const id = uid("toast");
    set((s) => ({ toasts: [...s.toasts, { id, level, message }].slice(-4) }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 7000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  applyRemote: (e) => {
    set((s) => {
      const agent = s.agents.find((a) => a.id === e.agentId);
      const agents =
        agent && (e.status || e.progress != null || e.pendingFiles || e.plan != null)
          ? s.agents.map((a) => {
              if (a.id !== e.agentId) return a;
              const progress = e.progress != null ? clamp(Math.round(e.progress), 0, 100) : undefined;
              const task =
                progress != null
                  ? a.task
                    ? { ...a.task, progress }
                    : { title: e.message ?? "Runtime task", branch: "", progress }
                  : a.task;
              const taskWithPlan = e.plan != null && task ? { ...task, plan: e.plan } : task;
              const pendingFiles = e.pendingFiles ?? (e.status && e.status !== "awaiting_approval" ? undefined : a.pendingFiles);
              const newStatus = e.status ?? a.status;
              const energyDrain = progress != null ? Math.max(0, Math.floor((progress - (a.task?.progress ?? 0)) / 7)) : 0;
              const energy = e.status === "idle"
                ? Math.min(100, a.energy + 15)
                : Math.max(0, a.energy - energyDrain);
              const xp = newStatus === "done" && a.status !== "done" ? a.xp + XP_PER_TASK : a.xp;
              return { ...a, status: newStatus, task: taskWithPlan, pendingFiles, energy, mood: moodFor(newStatus, energy, a.hunger, a.mood), xp };
            })
          : s.agents;

      const events = e.message
        ? [
            ...s.events,
            {
              id: uid("evt"),
              ts: Date.now(),
              agentId: e.agentId,
              agentName: e.agentName ?? agent?.name ?? "runtime",
              color: agent?.color ?? null,
              level: e.level ?? "INFO",
              message: e.message,
            },
          ].slice(-300)
        : s.events;

      let tasks = s.tasks;
      if (agent) {
        const tp: Partial<TaskRecord> = {};
        if (e.status) tp.status = e.status;
        if (e.progress != null) tp.progress = clamp(Math.round(e.progress), 0, 100);
        if (e.tokens != null) tp.tokens = e.tokens;
        const url = e.message?.match(/https?:\/\/\S+/)?.[0];
        if (url) tp.url = url;
        if (Object.keys(tp).length > 0) tasks = patchLatestTask(s.tasks, e.agentId, tp);
      }

      const tokensUsed = s.tokensUsed + (e.tokens ?? 0);

      return { agents, events, tasks, tokensUsed };
    });

    // Agent-to-agent relay: queue this for RelayBridge to process
    if (e.relayTo) {
      get().pushRelay({ ...e.relayTo, fromName: e.agentName ?? "?", fromId: e.agentId });
    }

    // Incoming webhook wake: queue this for WakeBridge to assign to a free agent
    if (e.wake) {
      get().pushWake(e.wake);
    }

    // Auto-clear task when runtime finishes without producing changes (status "idle"):
    // the agent didn't write anything useful so there's nothing to review — reset immediately.
    if (e.status === "idle") {
      setTimeout(() => {
        const agent = get().agents.find((x) => x.id === e.agentId);
        if (agent?.task && agent.status === "idle") get().clearTask(e.agentId);
      }, 900);
    }

    // surface notable outcomes as toasts
    if (e.message) {
      if (e.level === "ERROR") get().pushToast("ERROR", e.message);
      else if (e.level === "SUCCESS" && /\bPR\b|pull request|notion|https?:\/\//i.test(e.message))
        get().pushToast("SUCCESS", e.message);
    }
    // notify when an agent reaches a terminal state
    if (e.status === "done" || e.status === "review") {
      const name = e.agentName ?? e.agentId;
      get().pushToast("SUCCESS", e.status === "done" ? `✓ ${name} ha completato il task` : `⏳ ${name} — task in revisione`);
    } else if (e.status === "blocked") {
      const name = e.agentName ?? e.agentId;
      get().pushToast("ERROR", `⚠ ${name} bloccato`);
    }
  },
    }),
    {
      name: "sams.store",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Persist only durable slices — never transient UI/runtime flags.
      partialize: (s) => ({
        agents: s.agents,
        events: s.events,
        tasks: s.tasks,
        environment: s.environment,
        selectedAgentId: s.selectedAgentId,
        tokensUsed: s.tokensUsed,
        webhookAutoAssign: s.webhookAutoAssign,
        metaProactive: s.metaProactive,
        affinity: s.affinity,
        goals: s.goals,
        wallets: s.wallets,
        chains: s.chains,
        theme: s.theme,
        activity: s.activity,
        bottomTab: s.bottomTab,
        leftOpen: s.leftOpen,
        rightOpen: s.rightOpen,
        bottomOpen: s.bottomOpen,
        leftWidth: s.leftWidth,
        rightWidth: s.rightWidth,
        bottomHeight: s.bottomHeight,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // back-fill affinity + goals added after initial persist (migration)
          if (!state.affinity) state.affinity = {};
          if (!state.goals) state.goals = [];
          if (!state.wallets) state.wallets = {};
          if (!state.chains) state.chains = [];
          for (const a of state.agents) {
            // don't resume stale walk targets after a reload
            a.target = null;
            // back-fill fields added after initial persist (migration)
            if (a.instructions === undefined) a.instructions = "";
            if (a.taskQueue === undefined) a.taskQueue = [];
            if (typeof a.energy !== "number") a.energy = 100;
            if (typeof a.hunger !== "number") a.hunger = 0;
            if (typeof a.xp !== "number") a.xp = 0;
            // pending files are transient — never restore across reloads
            a.pendingFiles = undefined;
            // if agent was awaiting_approval before reload, reset to idle
            if (a.status === "awaiting_approval") a.status = "idle";
            // A persisted "working" status is always stale after a reload: no
            // local runtime loop survives the page refresh to drive it. Reset it
            // to idle (a genuine in-flight task re-syncs from the backend SSE).
            // This also clears legacy seed agents that were "working" forever.
            if (a.status === "working") {
              a.status = "idle";
              a.task = null;
            }
          }
        }
      },
    },
  ),
);

// Stable selector helpers ----------------------------------------------------

export const useSelectedAgent = (): Agent | null => {
  const id = useStore((s) => s.selectedAgentId);
  return useStore((s) => s.agents.find((a) => a.id === id) ?? null);
};
