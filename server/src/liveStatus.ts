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
  at: number;
}

const live = new Map<string, Live>();

/** Da chiamare per ogni evento trasmesso: tiene l'ultimo stato di ogni agente. */
export function noteAgentEvent(e: WireEvent, now = Date.now()): void {
  if (!e.agentId || !e.status) return;
  live.set(e.agentId, { status: e.status, progress: e.progress, at: now });
}

/** Lo snapshot con lo stato vivo del server sopra, dove è più recente. */
export function overlayLiveStatus(s: WorldSnapshot, now = Date.now()): WorldSnapshot {
  return {
    ...s,
    agents: s.agents.map((a) => {
      if (a.deleted) return a;
      const run = currentRun(a.id, now);
      if (run) return { ...a, status: "working", task: run.title };
      // In sala d'attesa finché una persona non conferma o rifiuta (push/merge sul principale).
      if (isMainGate(getPending(a.id))) return { ...a, status: "awaiting_approval" };
      const l = live.get(a.id);
      if (!l || l.at <= s.updatedAt) return a;
      if (l.status === "idle") return { ...a, status: "idle", task: null, progress: 0 };
      return { ...a, status: l.status, progress: l.progress ?? a.progress };
    }),
  };
}

/** Solo per i test. */
export function resetLiveStatus(): void {
  live.clear();
}
