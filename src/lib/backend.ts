import type { AgentStatus, LogLevel, PendingFile } from "../types";
import { useStore } from "../store/useStore";

// The runtime backend (SAMS ↔ agents). By default the app calls the SAME origin
// (`/api/...`), which Vite proxies to the local runtime — so the browser never
// makes a cross-origin request and CORS can't get in the way. Override with an
// absolute VITE_SAMS_BACKEND_URL only if you host the runtime elsewhere.
const BASE = ((import.meta.env.VITE_SAMS_BACKEND_URL as string | undefined) ?? "").replace(/\/$/, "");

export const backendEnabled = true;

export interface RemoteUpdate {
  agentId: string;
  agentName?: string;
  status?: AgentStatus;
  progress?: number;
  level?: LogLevel;
  message?: string;
  /** cumulative Gemini tokens for the task (sent once on completion) */
  tokens?: number;
  pendingFiles?: PendingFile[];
  relayTo?: { target: string; title: string; branch: string; context: string };
  plan?: string[];
  wake?: { title: string; branch?: string; reason: string; source?: "webhook" | "routine" };
  /** Presence: number of connected views, broadcast by the runtime on connect/disconnect. */
  presence?: number;
  /** Chat: a workspace chat message broadcast by the runtime. */
  chat?: { id: string; author: string; text: string; ts: number };
}

export type Provider = "gemini" | "claude" | "groq" | "openrouter";

export interface RuntimeStatus {
  provider: Provider;
  hasGeminiKey: boolean;
  hasAnthropicKey: boolean;
  hasGroqKey: boolean;
  hasOpenrouterKey: boolean;
  hasGithubToken: boolean;
  provisioned: boolean;
  ready: boolean;
  repo: string;
  baseBranch: string;
  model: string;
  openPRs: boolean;
  requireApproval: boolean;
  hasNotionToken: boolean;
  notionPageId: string;
  notionReady: boolean;
}

export interface SettingsInput {
  provider?: Provider;
  geminiApiKey?: string;
  anthropicApiKey?: string;
  groqApiKey?: string;
  openrouterApiKey?: string;
  githubToken?: string;
  githubRepo?: string;
  baseBranch?: string;
  model?: string;
  openPRs?: boolean;
  requireApproval?: boolean;
  notionToken?: string;
  notionPageId?: string;
}

export interface RuntimeMetrics {
  events: number;
  tasksStarted: number;
  tasksCompleted: number;
  errors: number;
  uptimeSec: number;
  clients: number;
  /** cumulative chat messages that flowed through the shared workspace */
  chatMessages?: number;
  /** high-water mark of simultaneously connected views */
  peakClients?: number;
  /** cumulative, durable totals from the task log (survive restarts) */
  lifetime?: { total: number; completed: number; tokens: number };
}

export interface TaskHistoryRow {
  agentId: string;
  agentName: string;
  title: string;
  branch: string;
  status: string;
  tokens: number;
  ts: number;
}

/** Current repo content of a file (the "before" of a staged diff); "" if new/unreachable. */
export async function fetchFile(path: string, ref?: string): Promise<{ content: string; exists: boolean }> {
  try {
    const q = new URLSearchParams({ path, ...(ref ? { ref } : {}) });
    const res = await fetch(`${BASE}/api/file?${q.toString()}`);
    if (!res.ok) return { content: "", exists: false };
    return (await res.json()) as { content: string; exists: boolean };
  } catch {
    return { content: "", exists: false };
  }
}

/** Read-only snapshot of the world for the shareable public dashboard. */
export interface PublicSnapshot {
  generatedAt: number;
  runtime: { provider: string; ready: boolean; repo: string; baseBranch: string; model: string };
  metrics: {
    tasksStarted: number;
    tasksCompleted: number;
    errors: number;
    uptimeSec: number;
    lifetimeTasks: number;
    lifetimeCompleted: number;
    lifetimeTokens: number;
  };
  garden: {
    contributors: number;
    totalWaterings: number;
    top: { user: string; stage: string; growth: number; waterings: number }[];
  };
  /** Riepilogo del mondo autorevole durevole (può mancare da runtime vecchi). */
  world?: { agents: number; working: number; idle: number };
  /** Quante viste stanno guardando ora (può mancare da runtime vecchi). */
  viewers?: number;
}

/** Fetch the public read-only snapshot; null if unreachable or unauthorized. */
export async function fetchPublicSnapshot(token?: string): Promise<PublicSnapshot | null> {
  try {
    const q = token ? `?token=${encodeURIComponent(token)}` : "";
    const res = await fetch(`${BASE}/api/public${q}`);
    if (!res.ok) return null;
    return (await res.json()) as PublicSnapshot;
  } catch {
    return null;
  }
}

/** Recent finished tasks from the runtime's durable log (empty if unreachable). */
export async function fetchHistory(): Promise<TaskHistoryRow[]> {
  try {
    const res = await fetch(`${BASE}/api/history`);
    if (!res.ok) return [];
    return (await res.json()) as TaskHistoryRow[];
  } catch {
    return [];
  }
}

/** Read the runtime's in-memory metrics (null if the runtime is unreachable). */
export async function fetchMetrics(): Promise<RuntimeMetrics | null> {
  try {
    const res = await fetch(`${BASE}/api/metrics`);
    if (!res.ok) return null;
    return (await res.json()) as RuntimeMetrics;
  } catch {
    return null;
  }
}

/** Read the runtime status (which keys are set, whether agents are provisioned). */
export async function fetchStatus(): Promise<RuntimeStatus | null> {
  try {
    const res = await fetch(`${BASE}/api/status`);
    if (!res.ok) return null;
    return (await res.json()) as RuntimeStatus;
  } catch {
    return null;
  }
}

/** Fetch status and reflect `ready` into the store (drives the banner). */
export async function refreshRuntimeStatus(): Promise<RuntimeStatus | null> {
  const st = await fetchStatus();
  useStore.getState().setRuntimeReady(!!st?.ready);
  return st;
}

/** Save settings (keys, repo, model…) entered in the app. */
export async function saveSettings(input: SettingsInput): Promise<RuntimeStatus> {
  const res = await fetch(`${BASE}/api/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
  return (await res.json()) as RuntimeStatus;
}

/** Create (or re-create) the managed Agent + Environment. */
export async function provisionAgents(): Promise<RuntimeStatus> {
  const res = await fetch(`${BASE}/api/provision`, { method: "POST" });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) msg = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as RuntimeStatus;
}

/** Ask the runtime to have a real managed agent work on a task. */
export async function assignRemote(
  agentId: string,
  agentName: string,
  title: string,
  branch?: string,
  role?: string,
  instructions?: string,
  repo?: string,
): Promise<void> {
  const res = await fetch(`${BASE}/api/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, agentName, title, branch, role, instructions, repo }),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) msg = data.error;
    } catch {
      const detail = await res.text().catch(() => "");
      if (detail) msg = detail;
    }
    throw new Error(msg);
  }
}

/** Approve staged files — triggers branch creation, commits and optional PR. */
export async function approveChanges(agentId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/approve/${encodeURIComponent(agentId)}`, { method: "POST" });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
}

/** Reject staged files — clears the buffer, agent goes idle. */
export async function rejectChanges(agentId: string): Promise<void> {
  await fetch(`${BASE}/api/reject/${encodeURIComponent(agentId)}`, { method: "POST" });
}

// --- Live Simulation mode ------------------------------------------------

export interface SimIssueRemote {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  labels: string[];
  claimedBy?: string;
}

export interface SimStatusRemote {
  enabled: boolean;
  label: string;
  claimedCount: number;
}

/** Read the server's authoritative Live Sim state (so client and server agree
 *  after a reload or reconnect). Returns null if unreachable. */
export async function fetchSimStatus(): Promise<SimStatusRemote | null> {
  try {
    const res = await fetch(`${BASE}/api/sim/status`);
    if (!res.ok) return null;
    return (await res.json()) as SimStatusRemote;
  } catch {
    return null;
  }
}

/** Start Live Sim mode on the server. */
export async function startSimMode(label = "sams"): Promise<void> {
  await fetch(`${BASE}/api/sim/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
}

/** Stop Live Sim mode on the server. */
export async function stopSimMode(): Promise<void> {
  await fetch(`${BASE}/api/sim/stop`, { method: "POST" });
}

/** Fetch open issues available for the Live Sim (with claim info). */
export async function fetchSimIssues(): Promise<SimIssueRemote[]> {
  try {
    const res = await fetch(`${BASE}/api/sim/issues`);
    if (!res.ok) return [];
    return (await res.json()) as SimIssueRemote[];
  } catch {
    return [];
  }
}

/** Atomically claim an issue for an agent. Returns true if claimed successfully. */
export async function claimSimIssue(issueNumber: number, agentId: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/sim/claim/${issueNumber}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Release a previously claimed issue. Passing agentId makes it owner-aware. */
export async function releaseSimIssue(issueNumber: number, agentId?: string): Promise<void> {
  await fetch(`${BASE}/api/sim/release/${issueNumber}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: agentId ?? "" }),
  }).catch(() => {});
}

/** Release whatever issue an agent holds (robust to a lost issue number). */
export async function releaseSimByAgent(agentId: string): Promise<void> {
  await fetch(`${BASE}/api/sim/release-by-agent/${encodeURIComponent(agentId)}`, {
    method: "POST",
  }).catch(() => {});
}

// --- Stato autorevole del mondo (Roadmap 4, primo slice) ------------------

export interface WorldAgentSnapshot {
  id: string;
  name: string;
  color: string;
  role: string;
  status: string;
  task: string | null;
  progress: number;
}

export interface WorldSnapshotRemote {
  agents: WorldAgentSnapshot[];
  updatedAt: number;
  version: number;
}

/** Read the server's durable authoritative world snapshot (null if unreachable). */
export async function fetchWorld(): Promise<WorldSnapshotRemote | null> {
  try {
    const res = await fetch(`${BASE}/api/world`);
    if (!res.ok) return null;
    return (await res.json()) as WorldSnapshotRemote;
  } catch {
    return null;
  }
}

/** Push the current world snapshot to the runtime for durable, shareable storage. */
export async function pushWorld(agents: WorldAgentSnapshot[]): Promise<void> {
  await fetch(`${BASE}/api/world`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agents }),
  }).catch(() => {});
}

// --- Chat di workspace (mondo condiviso) ---------------------------------

export interface ChatMessageRemote {
  id: string;
  author: string;
  text: string;
  ts: number;
}

/** Read the recent workspace chat (oldest-first); empty if unreachable. */
export async function fetchChat(): Promise<ChatMessageRemote[]> {
  try {
    const res = await fetch(`${BASE}/api/chat`);
    if (!res.ok) return [];
    return (await res.json()) as ChatMessageRemote[];
  } catch {
    return [];
  }
}

/** Post a chat message; the runtime broadcasts it back over SSE to every view. */
export async function sendChat(author: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// --- Routine / trigger temporali -----------------------------------------

export interface RoutineRemote {
  id: string;
  name: string;
  title: string;
  branch: string;
  kind: "interval" | "daily";
  intervalMin: number;
  atHour: number;
  atMin: number;
  enabled: boolean;
  lastRun: number;
  /** human-readable schedule, e.g. "ogni giorno alle 09:00" */
  schedule: string;
}

export interface RoutineDraft {
  name: string;
  title: string;
  branch?: string;
  kind: "interval" | "daily";
  intervalMin?: number;
  atHour?: number;
  atMin?: number;
}

/** List the runtime's scheduled routines (empty if unreachable). */
export async function fetchRoutines(): Promise<RoutineRemote[]> {
  try {
    const res = await fetch(`${BASE}/api/routines`);
    if (!res.ok) return [];
    return (await res.json()) as RoutineRemote[];
  } catch {
    return [];
  }
}

/** Create a routine; returns the stored routine or throws with the server error. */
export async function createRoutine(draft: RoutineDraft): Promise<RoutineRemote> {
  const res = await fetch(`${BASE}/api/routines`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as RoutineRemote;
}

export async function toggleRoutine(id: string, enabled: boolean): Promise<void> {
  await fetch(`${BASE}/api/routines/${encodeURIComponent(id)}/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  }).catch(() => {});
}

export async function deleteRoutine(id: string): Promise<void> {
  await fetch(`${BASE}/api/routines/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
}

export interface MemoryEntry { key: string; value: string; updatedAt: number }

export async function fetchMemory(agentId: string): Promise<MemoryEntry[]> {
  const res = await fetch(`${BASE}/api/memory/${encodeURIComponent(agentId)}`);
  if (!res.ok) return [];
  return (await res.json()) as MemoryEntry[];
}

export async function clearMemory(agentId: string): Promise<void> {
  await fetch(`${BASE}/api/memory/${encodeURIComponent(agentId)}`, { method: "DELETE" });
}

let source: EventSource | null = null;

/** Subscribe to the runtime's event stream; returns an unsubscribe function. */
export function connectBackend(): () => void {
  source = new EventSource(`${BASE}/api/events`);
  source.onopen = () => {
    useStore.getState().setBackendOnline(true);
    void refreshRuntimeStatus();
    // Reconcile sim state with the server: it's the source of truth, so a reload
    // or reconnect doesn't leave the client thinking the sim is off while the
    // server keeps running it (or vice-versa).
    void fetchSimStatus().then((st) => {
      if (!st) return;
      useStore.getState().setSimMode(st.enabled);
      useStore.getState().setSimLabel(st.label);
    });
    // Hydrate the workspace chat from the server (the durable source of truth).
    void fetchChat().then((msgs) => useStore.getState().setChatMessages(msgs));
  };
  source.onerror = () => useStore.getState().setBackendOnline(false);
  source.onmessage = (ev) => {
    try {
      useStore.getState().applyRemote(JSON.parse(ev.data) as RemoteUpdate);
    } catch {
      /* ignore keep-alive comments and malformed payloads */
    }
  };
  return () => {
    source?.close();
    source = null;
    useStore.getState().setBackendOnline(false);
  };
}
