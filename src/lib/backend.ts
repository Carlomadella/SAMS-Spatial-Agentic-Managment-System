import type { AgentStatus, LogLevel } from "../types";
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
}

export type Provider = "gemini" | "claude";

export interface RuntimeStatus {
  provider: Provider;
  hasGeminiKey: boolean;
  hasAnthropicKey: boolean;
  hasGithubToken: boolean;
  provisioned: boolean;
  ready: boolean;
  repo: string;
  baseBranch: string;
  model: string;
  openPRs: boolean;
  hasNotionToken: boolean;
  notionPageId: string;
  notionReady: boolean;
}

export interface SettingsInput {
  provider?: Provider;
  geminiApiKey?: string;
  anthropicApiKey?: string;
  githubToken?: string;
  githubRepo?: string;
  baseBranch?: string;
  model?: string;
  openPRs?: boolean;
  notionToken?: string;
  notionPageId?: string;
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
): Promise<void> {
  const res = await fetch(`${BASE}/api/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, agentName, title, branch, role }),
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
  source.onopen = () => {
    useStore.getState().setBackendOnline(true);
    void refreshRuntimeStatus();
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
