// Coda dei task sul server con «aspetta che finisca» (idea 4 da Paperclip, scelta A del 25/11/2026).
// Sostituisce la coda nel browser: il server avvia da solo il task dopo, anche a pagina chiusa.

import { create } from "zustand";
import { BASE, authHeaders, viewerName } from "./backend";
import { useStore } from "../store/useStore";
import { resolveTaskRepo } from "./metaAgent";
import type { Agent } from "../types";

export interface ServerQueued {
  id: string;
  agentId: string;
  agentName: string;
  title: string;
  branch: string;
  status: string;
  createdBy: string;
  createdAt: number;
  afterTaskId: string;
  urgent: boolean;
  waitNote: string;
}

/** La coda intera, aggiornata dallo stream (evento "queue") e alla prima lettura. */
export const useServerQueue = create<{ list: ServerQueued[]; loaded: boolean }>(() => ({ list: [], loaded: false }));

export function queueOf(list: ServerQueued[], agentId: string): ServerQueued[] {
  return list.filter((q) => q.agentId === agentId);
}

/** Dallo stream: `{ agentId: "queue", queue: [...] }`. */
export function noteQueueEvent(e: { agentId?: string; queue?: unknown }): void {
  if (e.agentId !== "queue" || !Array.isArray(e.queue)) return;
  useServerQueue.setState({ list: e.queue as ServerQueued[], loaded: true });
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function refreshQueue(): Promise<void> {
  try {
    const list = await asJson<ServerQueued[]>(await fetch(`${BASE}/api/queue`, { headers: authHeaders(false) }));
    useServerQueue.setState({ list, loaded: true });
  } catch {
    /* offline: resta quello che arriva dallo stream */
  }
}

export interface QueueOptions {
  title: string;
  branch?: string;
  /** repo indicata per questo task (vuoto = quella dell'agente) */
  repo?: string;
  urgent?: boolean;
  environment?: string;
  /** parte quando finisce questo task (anche di un altro agente) */
  afterTaskId?: string;
}

/**
 * Mette un task nella coda del server. Se l'agente è libero e non deve aspettare nessuno
 * parte subito; altrimenti parte da solo quando può. Gli errori finiscono nel registro.
 */
export async function queueTask(agent: Pick<Agent, "id" | "name" | "color" | "role" | "instructions" | "repo" | "meta">, o: QueueOptions): Promise<void> {
  try {
    await asJson(
      await fetch(`${BASE}/api/queue`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          agentId: agent.id,
          agentName: agent.name,
          title: o.title,
          branch: o.branch,
          role: agent.role,
          instructions: agent.instructions,
          repo: resolveTaskRepo(agent, o.repo),
          environment: o.environment ?? useStore.getState().environment,
          urgent: !!o.urgent,
          afterTaskId: o.afterTaskId || undefined,
          actor: viewerName(),
        }),
      }),
    );
    useStore.getState().log({ agentId: agent.id, agentName: agent.name, color: agent.color, level: "INFO", message: `In coda${o.urgent ? " (urgente)" : ""}: ${o.title}` });
  } catch (err) {
    useStore.getState().log({ agentId: agent.id, agentName: agent.name, color: agent.color, level: "ERROR", message: `Coda: ${(err as Error).message}` });
    throw err;
  }
}

export async function removeQueuedRemote(id: string): Promise<void> {
  await asJson(await fetch(`${BASE}/api/queue/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeaders(), body: JSON.stringify({ actor: viewerName() }) }));
}

export async function startAnywayRemote(id: string): Promise<void> {
  await asJson(await fetch(`${BASE}/api/queue/${encodeURIComponent(id)}/start-anyway`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ actor: viewerName() }) }));
}
