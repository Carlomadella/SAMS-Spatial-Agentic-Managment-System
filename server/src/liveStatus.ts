// Stato vivo degli agenti, visto dal server (simulazione del 21/11: con nessuno nella
// stanza, /api/world mostrava Sim-Dev "bloccato" mentre lavorava, perché lo snapshot lo
// salva solo il browser che guida il mondo). Il server sa da sé come vanno i task: gli
// eventi che trasmette e il registro dei task in corso. In lettura li sovrappone allo
// snapshot salvato, se sono più recenti; non scrive nulla, quindi non entra in
// conflitto con le viste che salvano il mondo.

import type { WireEvent } from "./types";
import { currentRun } from "./taskRuns";
import type { WorldSnapshot } from "./worldState";
import { getPending, isMainGate } from "./pendingBuffer";

interface Live {
  status: NonNullable<WireEvent["status"]>;
  progress?: number;
  /** titolo dell'ultimo task avviato: lo snapshot può avere ancora quello di prima */
  task?: string;
  at: number;
}

/** L'ultimo task di un agente nello storico (task_log): sopravvive ai riavvii. */
export interface LoggedTask {
  status: string;
  title: string;
  ts: number;
}

const LOGGED_STATUSES = new Set(["idle", "working", "review", "blocked", "done", "awaiting_approval"]);

const live = new Map<string, Live>();
const titles = new Map<string, string>();

/** Da chiamare quando parte un task: il titolo accompagna gli stati che seguono. */
export function noteTaskStarted(agentId: string, title: string, now = Date.now()): void {
  titles.set(agentId, title);
  live.set(agentId, { status: "working", progress: 0, task: title, at: now });
}

/** Da chiamare per ogni evento trasmesso: tiene l'ultimo stato di ogni agente. */
export function noteAgentEvent(e: WireEvent, now = Date.now()): void {
  if (!e.agentId || !e.status) return;
  live.set(e.agentId, { status: e.status, progress: e.progress, task: titles.get(e.agentId), at: now });
}

/**
 * Lo snapshot con lo stato del server sopra, dove è più recente. In ordine: il task in
 * corso, la sala d'attesa, poi il più recente tra lo stato in memoria e l'ultimo task
 * dello storico (simulazione 22/11: dopo un riavvio la memoria è vuota e lo snapshot
 * salvato da una vista era di due giorni prima, «fatto» col task vecchio mentre
 * l'agente era bloccato su quello nuovo).
 */
export function overlayLiveStatus(s: WorldSnapshot, now = Date.now(), logged: ReadonlyMap<string, LoggedTask> = new Map()): WorldSnapshot {
  return {
    ...s,
    agents: s.agents.map((a) => {
      if (a.deleted) return a;
      const run = currentRun(a.id, now);
      if (run) return { ...a, status: "working", task: run.title };
      // In sala d'attesa finché una persona non conferma o rifiuta (push/merge sul principale).
      if (isMainGate(getPending(a.id))) return { ...a, status: "awaiting_approval" };
      const l = live.get(a.id);
      const t = logged.get(a.id);
      const fromLog = t && LOGGED_STATUSES.has(t.status) && t.ts > s.updatedAt && (!l || t.ts > l.at) ? t : null;
      if (fromLog) {
        if (fromLog.status === "idle") return { ...a, status: "idle", task: null, progress: 0 };
        return { ...a, status: fromLog.status, task: fromLog.title };
      }
      if (!l || l.at <= s.updatedAt) return a;
      if (l.status === "idle") return { ...a, status: "idle", task: null, progress: 0 };
      return { ...a, status: l.status, progress: l.progress ?? a.progress, task: l.task ?? a.task };
    }),
  };
}

/** Solo per i test. */
export function resetLiveStatus(): void {
  live.clear();
  titles.clear();
}
