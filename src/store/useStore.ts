import { create } from "zustand";
import {
  AGENT_COLORS,
  type ActivityView,
  type Agent,
  type AgentColor,
  type AgentStatus,
  type BottomTab,
  type EnvironmentName,
  type LogEvent,
  type LogLevel,
  type Toast,
  type Vec2,
} from "../types";
import { SEED_AGENTS, seedEvents } from "../data/seed";
import { clampToRoom, SPAWN_POINT, ZONE_BY_ID } from "../data/world";
import { clamp, uid } from "../lib/utils";

const STATUS_LEVEL: Record<AgentStatus, LogLevel> = {
  idle: "IDLE",
  working: "INFO",
  review: "WARN",
  blocked: "ERROR",
  done: "SUCCESS",
};

interface State {
  // --- domain ---
  agents: Agent[];
  events: LogEvent[];
  environment: EnvironmentName;
  selectedAgentId: string | null;

  // --- ui ---
  activity: ActivityView;
  bottomTab: BottomTab;
  commandOpen: boolean;
  settingsOpen: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  bottomOpen: boolean;

  /** whether the optional managed-agents runtime is connected */
  backendOnline: boolean;
  /** whether the runtime has its keys set (ready to run tasks) */
  runtimeReady: boolean;
  /** transient on-screen notifications */
  toasts: Toast[];

  // --- actions: agents ---
  addAgent: (color?: AgentColor) => string;
  removeAgent: (id: string) => void;
  selectAgent: (id: string | null) => void;
  moveAgent: (id: string, target: Vec2) => void;
  arriveAgent: (id: string) => void;
  sendToZone: (id: string, zoneId: string) => void;
  setStatus: (id: string, status: AgentStatus) => void;
  assignTask: (id: string, title: string, branch: string) => void;
  updateProgress: (id: string, progress: number) => void;
  clearTask: (id: string) => void;
  renameAgent: (id: string, name: string) => void;

  // --- actions: world / log ---
  log: (e: Omit<LogEvent, "id" | "ts">) => void;
  clearEvents: () => void;
  setEnvironment: (env: EnvironmentName) => void;
  resetWorld: () => void;

  // --- actions: ui ---
  setActivity: (a: ActivityView) => void;
  setBottomTab: (t: BottomTab) => void;
  setCommandOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  toggleBottom: () => void;

  // --- actions: runtime (managed agents) ---
  setBackendOnline: (online: boolean) => void;
  setRuntimeReady: (ready: boolean) => void;
  pushToast: (level: LogLevel, message: string) => void;
  dismissToast: (id: string) => void;
  applyRemote: (e: {
    agentId: string;
    agentName?: string;
    status?: AgentStatus;
    progress?: number;
    level?: LogLevel;
    message?: string;
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

export const useStore = create<State>()((set, get) => ({
  agents: SEED_AGENTS.map((a) => ({ ...a })),
  events: seedEvents(),
  environment: "staging",
  selectedAgentId: "agent-blue",

  activity: "explorer",
  bottomTab: "eventlog",
  commandOpen: false,
  settingsOpen: false,
  leftOpen: true,
  rightOpen: true,
  bottomOpen: true,
  backendOnline: false,
  runtimeReady: false,
  toasts: [],

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
      status: "idle",
      position: [...SPAWN_POINT] as Vec2,
      target: null,
      task: null,
    };
    set((s) => ({ agents: [...s.agents, agent], selectedAgentId: id }));
    log({ agentId: id, agentName: name, color: c, level: "INFO", message: "Agent spawned into workspace" });
    return id;
  },

  removeAgent: (id) => {
    const a = get().agents.find((x) => x.id === id);
    set((s) => ({
      agents: s.agents.filter((x) => x.id !== id),
      selectedAgentId: s.selectedAgentId === id ? null : s.selectedAgentId,
    }));
    if (a) get().log({ agentId: null, agentName: a.name, color: a.color, level: "WARN", message: "Agent removed from workspace" });
  },

  selectAgent: (id) => set({ selectedAgentId: id }),

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
    get().log({ agentId: id, agentName: a.name, color: a.color, level: "INFO", message: `Heading to ${zone.label} · ${zone.sublabel}` });
  },

  setStatus: (id, status) => {
    const a = get().agents.find((x) => x.id === id);
    set((s) => ({
      agents: s.agents.map((x) => (x.id === id ? { ...x, status } : x)),
    }));
    if (a) {
      const msg: Record<AgentStatus, string> = {
        idle: "Now idle · no active tasks",
        working: "Resumed work",
        review: "Waiting for review",
        blocked: "Blocked · needs attention",
        done: "Marked task as done",
      };
      get().log({ agentId: id, agentName: a.name, color: a.color, level: STATUS_LEVEL[status], message: msg[status] });
    }
  },

  assignTask: (id, title, branch) => {
    const a = get().agents.find((x) => x.id === id);
    if (!a) return;
    set((s) => ({
      agents: s.agents.map((x) =>
        x.id === id
          ? { ...x, status: "working", task: { title, branch: branch || "main", progress: 0 } }
          : x,
      ),
    }));
    get().log({ agentId: id, agentName: a.name, color: a.color, level: "INFO", message: `Started task: ${title}` });
  },

  updateProgress: (id, progress) => {
    const p = clamp(Math.round(progress), 0, 100);
    const a = get().agents.find((x) => x.id === id);
    if (!a || !a.task) return;
    const willComplete = p >= 100 && a.task.progress < 100;
    set((s) => ({
      agents: s.agents.map((x) =>
        x.id === id && x.task
          ? { ...x, task: { ...x.task, progress: p }, status: p >= 100 ? "done" : x.status }
          : x,
      ),
    }));
    if (willComplete) {
      get().log({ agentId: id, agentName: a.name, color: a.color, level: "SUCCESS", message: `Task complete: ${a.task.title}` });
    }
  },

  clearTask: (id) => {
    const a = get().agents.find((x) => x.id === id);
    set((s) => ({
      agents: s.agents.map((x) => (x.id === id ? { ...x, task: null, status: "idle" } : x)),
    }));
    if (a) get().log({ agentId: id, agentName: a.name, color: a.color, level: "IDLE", message: "Cleared task · now idle" });
  },

  renameAgent: (id, name) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, name: name || a.name } : a)),
    })),

  clearEvents: () => set({ events: [] }),

  setEnvironment: (env) => {
    set({ environment: env });
    get().log({ agentId: null, agentName: "system", color: null, level: "INFO", message: `Switched environment → ${env}` });
  },

  resetWorld: () =>
    set({
      agents: SEED_AGENTS.map((a) => ({ ...a })),
      events: seedEvents(),
      selectedAgentId: "agent-blue",
      environment: "staging",
    }),

  setActivity: (a) => set({ activity: a }),
  setBottomTab: (t) => set({ bottomTab: t, bottomOpen: true }),
  setCommandOpen: (open) => set({ commandOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
  toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
  toggleBottom: () => set((s) => ({ bottomOpen: !s.bottomOpen })),

  setBackendOnline: (online) => set({ backendOnline: online }),
  setRuntimeReady: (ready) => set({ runtimeReady: ready }),

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
        agent && (e.status || e.progress != null)
          ? s.agents.map((a) => {
              if (a.id !== e.agentId) return a;
              const progress = e.progress != null ? clamp(Math.round(e.progress), 0, 100) : undefined;
              const task =
                progress != null
                  ? a.task
                    ? { ...a.task, progress }
                    : { title: e.message ?? "Runtime task", branch: "", progress }
                  : a.task;
              return { ...a, status: e.status ?? a.status, task };
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

      return { agents, events };
    });

    // surface notable outcomes as toasts
    if (e.message) {
      if (e.level === "ERROR") get().pushToast("ERROR", e.message);
      else if (e.level === "SUCCESS" && /\bPR\b|pull request|notion|https?:\/\//i.test(e.message))
        get().pushToast("SUCCESS", e.message);
    }
  },
}));

// Stable selector helpers ----------------------------------------------------

export const useSelectedAgent = (): Agent | null => {
  const id = useStore((s) => s.selectedAgentId);
  return useStore((s) => s.agents.find((a) => a.id === id) ?? null);
};
