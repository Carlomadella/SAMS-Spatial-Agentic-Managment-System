import type { AgentColor, LogEvent, LogLevel } from "../types";

// Replay cinematografico — ricostruisce la "clip" di ciò che ha fatto un agente
// a partire dal flusso di eventi: una timeline scrubbabile (play/pausa + cursore)
// con un fotogramma per evento saliente. Tutto puro e testabile; la UI
// (`ReplayPanel`) legge gli stessi `events` dello store.

export interface ReplayFrame {
  id: string;
  /** epoch ms dell'evento */
  ts: number;
  /** ms dall'inizio della clip (0 = primo fotogramma) */
  tMs: number;
  level: LogLevel;
  message: string;
  /** emoji simbolica del fotogramma */
  emoji: string;
}

export interface Replay {
  agentId: string | null;
  agentName: string;
  color: AgentColor | null;
  startTs: number;
  endTs: number;
  /** durata totale della clip in ms (0 se un solo fotogramma) */
  durationMs: number;
  frames: ReplayFrame[];
}

/** Emoji del fotogramma da livello + parole chiave del messaggio. */
export function frameEmoji(e: Pick<LogEvent, "level" | "message">): string {
  const msg = e.message;
  if (/\bPR\b|pull request/i.test(msg)) return "🔀";
  if (/pian|announce_plan/i.test(msg)) return "🧭";
  if (/relay|passa|handoff/i.test(msg)) return "🤝";
  switch (e.level) {
    case "SUCCESS": return "✅";
    case "ERROR": return "❌";
    case "WARN": return "⚠️";
    case "IDLE": return "😴";
    default: return "💬";
  }
}

/**
 * Costruisce una replay da eventi **già filtrati** per un agente (o un task).
 * Li ordina per tempo e calcola l'offset relativo. Ritorna null se vuoto.
 */
export function buildReplay(events: LogEvent[]): Replay | null {
  if (events.length === 0) return null;
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const startTs = sorted[0].ts;
  const endTs = sorted[sorted.length - 1].ts;
  const first = sorted[0];
  const frames: ReplayFrame[] = sorted.map((e) => ({
    id: e.id,
    ts: e.ts,
    tMs: e.ts - startTs,
    level: e.level,
    message: e.message,
    emoji: frameEmoji(e),
  }));
  return {
    agentId: first.agentId,
    agentName: first.agentName,
    color: first.color,
    startTs,
    endTs,
    durationMs: endTs - startTs,
    frames,
  };
}

/**
 * Raggruppa gli eventi per agente in una replay ciascuno, ordinate dalla più
 * recente. Scarta gli eventi senza agente (rumore di sistema).
 */
export function agentReplays(events: LogEvent[]): Replay[] {
  const byAgent = new Map<string, LogEvent[]>();
  for (const e of events) {
    if (!e.agentId) continue;
    const arr = byAgent.get(e.agentId) ?? [];
    arr.push(e);
    byAgent.set(e.agentId, arr);
  }
  const replays: Replay[] = [];
  for (const arr of byAgent.values()) {
    const r = buildReplay(arr);
    if (r) replays.push(r);
  }
  // la più "fresca" per prima (fine più recente)
  return replays.sort((a, b) => b.endTs - a.endTs);
}

/**
 * Indice dell'ultimo fotogramma il cui offset è ≤ `tMs` (il "playhead").
 * Ritorna -1 prima del primo fotogramma, l'ultimo indice a fine clip.
 */
export function frameIndexAt(frames: Pick<ReplayFrame, "tMs">[], tMs: number): number {
  let idx = -1;
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].tMs <= tMs) idx = i;
    else break;
  }
  return idx;
}

/** Offset in ms formattato come "m:ss" (es. 65000 → "1:05"). */
export function formatOffset(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
