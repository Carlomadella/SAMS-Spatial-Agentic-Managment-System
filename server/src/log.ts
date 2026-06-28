/** Structured, leveled logger. Reads LOG_LEVEL from the environment (debug/info/warn/error). */

const RANKS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof RANKS;

const minRank: number = RANKS[(process.env.LOG_LEVEL as Level | undefined) ?? "info"] ?? 1;

function emit(level: Level, msg: string, meta?: Record<string, unknown>): void {
  if (RANKS[level] < minRank) return;
  const entry = JSON.stringify({ t: new Date().toISOString(), level, msg, ...meta });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}

export const log = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
  info:  (msg: string, meta?: Record<string, unknown>) => emit("info",  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => emit("warn",  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};
