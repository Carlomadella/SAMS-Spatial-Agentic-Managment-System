import type { AgentStatus, LogLevel } from "../types";
import { useStore } from "../store/useStore";

// The runtime backend (SAMS ↔ Claude Managed Agents). Defaults to the local
// runtime so everything works from the app without editing any config; override
// with VITE_SAMS_BACKEND_URL if you host it elsewhere.
const BASE =
  ((import.meta.env.VITE_SAMS_BACKEND_URL as string | undefined) || "http://localhost:8787").replace(/\/$/, "");

export const backendEnabled = BASE.length > 0;

export interface RemoteUpdate {
  agentId: string;
  agentName?: string;
  status?: AgentStatus;
  progress?: number;
  level?: LogLevel;
  message?: string;
}

export interface RuntimeStatus {
  hasAnthropicKey: boolean;
  hasGithubToken: boolean;
  provisioned: boolean;
  ready: boolean;
  repo: string;
  baseBranch: string;
  model: string;
  openPRs: boolean;
}

export interface SettingsInput {
  anthropicApiKey?: string;
  githubToken?: string;
  githubRepo?: string;
  baseBranch?: string;
  model?: string;
  openPRs?: boolean;
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
): Promise<void> {
  const res = await fetch(`${BASE}/api/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, agentName, title, branch }),
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

let source: EventSource | null = null;

/** Subscribe to the runtime's event stream; returns an unsubscribe function. */
export function connectBackend(): () => void {
  source = new EventSource(`${BASE}/api/events`);
  source.onopen = () => useStore.getState().setBackendOnline(true);
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
