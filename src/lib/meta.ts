import type { AgentColor, AgentStatus, LogLevel } from "../types";

export const STATUS_META: Record<
  AgentStatus,
  { label: string; text: string; dot: string; ring: string; hex: string }
> = {
  // `hex` mirrors the tailwind `dot` class above (slate/sky/amber/rose/emerald/rose-400):
  // single source of truth per lo stato, condiviso da scena 3D e pannelli 2D.
  idle: { label: "Inattivo", text: "text-mut", dot: "bg-slate-400", ring: "ring-slate-500/30", hex: "#94a3b8" },
  working: { label: "In corso", text: "text-slate-300", dot: "bg-slate-400", ring: "ring-slate-500/40", hex: "#38bdf8" },
  review: { label: "In revisione", text: "text-slate-300", dot: "bg-slate-400", ring: "ring-slate-500/40", hex: "#fbbf24" },
  blocked: { label: "Bloccato", text: "text-rose-300", dot: "bg-rose-400", ring: "ring-rose-500/40", hex: "#fb7185" },
  done: { label: "Completato", text: "text-emerald-300", dot: "bg-emerald-400", ring: "ring-emerald-500/40", hex: "#34d399" },
  awaiting_approval: { label: "In attesa di approvazione", text: "text-rose-300", dot: "bg-rose-400", ring: "ring-rose-500/40", hex: "#a78bfa" },
};

/** Colore esadecimale di uno stato agente, con fallback al grigio "idle" per input ignoti. */
export function statusHex(status: string): string {
  return STATUS_META[status as AgentStatus]?.hex ?? STATUS_META.idle.hex;
}

export const LEVEL_META: Record<LogLevel, { text: string; label: string; badge: string }> = {
  INFO: { text: "text-slate-300", label: "INFO", badge: "bg-slate-500/10 text-slate-300 ring-slate-400/20" },
  SUCCESS: { text: "text-emerald-300", label: "SUCCESS", badge: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20" },
  WARN: { text: "text-slate-300", label: "WARN", badge: "bg-slate-500/10 text-slate-300 ring-slate-400/20" },
  ERROR: { text: "text-rose-300", label: "ERROR", badge: "bg-rose-500/10 text-rose-300 ring-rose-400/20" },
  IDLE: { text: "text-slate-400", label: "IDLE", badge: "bg-slate-500/10 text-slate-400 ring-slate-400/20" },
};

/** Tailwind text/bg helpers for an agent color (the dot in lists, etc.). */
export const AGENT_DOT: Record<AgentColor, string> = {
  blue: "bg-agent-blue",
  green: "bg-agent-green",
  orange: "bg-agent-orange",
  purple: "bg-agent-purple",
  red: "bg-agent-red",
  yellow: "bg-agent-yellow",
};

export const AGENT_TEXT: Record<AgentColor, string> = {
  blue: "text-agent-blue",
  green: "text-agent-green",
  orange: "text-agent-orange",
  purple: "text-agent-purple",
  red: "text-agent-red",
  yellow: "text-agent-yellow",
};
