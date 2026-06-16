import type { AgentStatus, LogLevel } from "../types";
import { useStore } from "../store/useStore";

// The runtime backend (SAMS ↔ Claude Managed Agents). When VITE_SAMS_BACKEND_URL
// is unset, SAMS stays a pure manual sandbox and none of this is used.
const BASE =
  (import.meta.env.VITE_SAMS_BACKEND_URL as string | undefined)?.replace(/\/$/, "") || "";

export const backendEnabled = BASE.length > 0;

export interface RemoteUpdate {
  agentId: string;
  agentName?: string;
  status?: AgentStatus;
  progress?: number;
  level?: LogLevel;
  message?: string;
}

/** Ask the runtime to have a real managed agent work on a task. */
export async function assignRemote(
  agentId: string,
  agentName: string,
  title: string,
  branch?: string,
): Promise<void> {
  if (!backendEnabled) return;
  const res = await fetch(`${BASE}/api/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, agentName, title, branch }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `HTTP ${res.status}`);
  }
}

let source: EventSource | null = null;

/** Subscribe to the runtime's event stream; returns an unsubscribe function. */
export function connectBackend(): () => void {
  if (!backendEnabled) return () => {};
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
