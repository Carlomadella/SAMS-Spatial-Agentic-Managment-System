// Punto di lavoro dal vivo (idea 5): lo aggiorna ogni strumento eseguito dall'agente e lo
// salva nel DB, in ordine. Best-effort: un errore del DB non ferma mai il lavoro.

import { db } from "./db";
import { log } from "./log";
import { applyStep, emptyCheckpoint, saveCheckpoint, type Checkpoint } from "./checkpoints";

interface Live {
  taskId: string;
  cp: Checkpoint;
  chain: Promise<void>;
}

const live = new Map<string, Live>();

/** Il task dell'agente parte: si riparte dal punto di lavoro precedente (se ripreso) o da zero. */
export function beginCheckpoint(agentId: string, taskId: string, attempt: number, previous: Checkpoint | null): void {
  live.set(agentId, { taskId, cp: previous ? { ...previous, attempt } : emptyCheckpoint(attempt), chain: Promise.resolve() });
}

/** Dopo ogni strumento (lo chiama executeTool). */
export function noteToolStep(agentId: string, tool: string, args: Record<string, unknown>, result: string): void {
  const l = live.get(agentId);
  if (!l) return;
  l.cp = applyStep(l.cp, tool, args, result);
  const snapshot = l.cp;
  l.chain = l.chain
    .then(() => saveCheckpoint(db(), l.taskId, snapshot))
    .catch((err) => log.warn("Punto di lavoro non salvato", { task: l.taskId, err: String(err) }));
}

export function endCheckpoint(agentId: string): void {
  live.delete(agentId);
}
