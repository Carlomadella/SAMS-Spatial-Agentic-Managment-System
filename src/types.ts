// ---------------------------------------------------------------------------
// SAMS — domain model
// ---------------------------------------------------------------------------

/** The six "Sims-like" agent colors. The key doubles as a stable palette id. */
export type AgentColor =
  | "blue"
  | "green"
  | "orange"
  | "purple"
  | "red"
  | "yellow";

export const AGENT_COLORS: AgentColor[] = [
  "blue",
  "green",
  "orange",
  "purple",
  "red",
  "yellow",
];

/** Hex values mirror tailwind.config `agent.*`. Kept here for the 3D scene. */
export const AGENT_HEX: Record<AgentColor, string> = {
  blue: "#3b82f6",
  green: "#22c55e",
  orange: "#f97316",
  purple: "#a855f7",
  red: "#ef4444",
  yellow: "#eab308",
};

export type AgentStatus =
  | "idle"
  | "working"
  | "review"
  | "blocked"
  | "done";

export type LogLevel = "INFO" | "SUCCESS" | "WARN" | "ERROR" | "IDLE";

/** Transient on-screen notification. */
export interface Toast {
  id: string;
  level: LogLevel;
  message: string;
}

export type EnvironmentName = "dev" | "staging" | "prod";

/** A point on the floor plane, in world units (x = east/west, z = north/south). */
export type Vec2 = [number, number];

export interface Task {
  title: string;
  branch: string;
  /** 0..100 */
  progress: number;
}

/** A historical record of an assigned task (for the Tasks panel). */
export interface TaskRecord {
  id: string;
  agentId: string;
  agentName: string;
  color: AgentColor | null;
  title: string;
  branch: string;
  status: AgentStatus;
  /** 0..100 */
  progress: number;
  /** a result link (PR or Notion), if any */
  url?: string;
  /** Gemini tokens used by this task, if reported by the runtime */
  tokens?: number;
  createdAt: number;
}

/** A task waiting in the agent's queue to be started when the agent is free. */
export interface QueuedTask {
  title: string;
  branch: string;
}

export interface Agent {
  id: string;
  name: string;
  color: AgentColor;
  /** Free-text flavor — which model / role this agent represents. */
  model: string;
  role: string;
  /** Standing instructions injected into the system prompt on every task. */
  instructions: string;
  status: AgentStatus;
  /** Committed floor position. */
  position: Vec2;
  /** Where the agent is walking to, if anywhere. */
  target: Vec2 | null;
  task: Task | null;
  /** Tasks waiting to start once this agent finishes its current task. */
  taskQueue: QueuedTask[];
}

export interface LogEvent {
  id: string;
  /** epoch ms */
  ts: number;
  agentId: string | null;
  agentName: string;
  color: AgentColor | null;
  level: LogLevel;
  message: string;
}

/** A fixed point of interest in the office the user can dispatch agents to. */
export interface Zone {
  id: string;
  label: string;
  sublabel: string;
  position: Vec2;
}

// --- Explorer file tree -----------------------------------------------------

export type FileBadge = "M" | "U" | "A" | null;

export interface FileNode {
  id: string;
  name: string;
  kind: "folder" | "file";
  /** git-style status badge shown on the right (M = modified, U = untracked). */
  badge?: FileBadge;
  /** when set, clicking the node selects this agent */
  agentId?: string;
  children?: FileNode[];
}

// --- UI state ---------------------------------------------------------------

export type ActivityView =
  | "explorer"
  | "search"
  | "scm"
  | "cad"
  | "extensions";

export type BottomTab = "terminal" | "output" | "eventlog" | "problems" | "tasks";
