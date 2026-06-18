import type { AgentColor, AgentStatus, LogLevel } from "../types";

export const STATUS_META: Record<
  AgentStatus,
  { label: string; text: string; dot: string; ring: string }
> = {
  idle: { label: "Idle", text: "text-mut", dot: "bg-slate-400", ring: "ring-slate-500/30" },
  working: { label: "In Progress", text: "text-sky-300", dot: "bg-sky-400", ring: "ring-sky-500/40" },
  review: { label: "In Review", text: "text-amber-300", dot: "bg-amber-400", ring: "ring-amber-500/40" },
  blocked: { label: "Blocked", text: "text-rose-300", dot: "bg-rose-400", ring: "ring-rose-500/40" },
  done: { label: "Done", text: "text-emerald-300", dot: "bg-emerald-400", ring: "ring-emerald-500/40" },
};

export const LEVEL_META: Record<LogLevel, { text: string; label: string; badge: string }> = {
  INFO: { text: "text-sky-300", label: "INFO", badge: "bg-sky-500/10 text-sky-300 ring-sky-400/20" },
  SUCCESS: { text: "text-emerald-300", label: "SUCCESS", badge: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20" },
  WARN: { text: "text-amber-300", label: "WARN", badge: "bg-amber-500/10 text-amber-300 ring-amber-400/20" },
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
