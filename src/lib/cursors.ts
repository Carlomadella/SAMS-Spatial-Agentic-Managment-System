// Live presence cursors (Roadmap 4, frontiera #2). Pure helpers shared by the
// store (which keeps the incoming cursors) and the scene (which draws them).
// Cursors are ephemeral: a view that stops moving — or disconnects — simply goes
// stale and fades out, so there's no explicit "remove" message to handle.

export interface LiveCursor {
  id: string;
  name: string;
  x: number;
  z: number;
  /** client-side receipt time, used to fade & prune stale cursors. */
  ts: number;
}

/** How long a cursor lives after its last update before it's dropped (ms). */
export const CURSOR_TTL = 4000;

/**
 * Drop cursors older than `ttl`. Returns the SAME object when nothing changed so
 * callers can skip a needless state update (and re-render).
 */
export function pruneCursors(
  cursors: Record<string, LiveCursor>,
  now: number,
  ttl = CURSOR_TTL,
): Record<string, LiveCursor> {
  let changed = false;
  const kept: Record<string, LiveCursor> = {};
  for (const [id, c] of Object.entries(cursors)) {
    if (now - c.ts <= ttl) kept[id] = c;
    else changed = true;
  }
  return changed ? kept : cursors;
}

/**
 * Opacity for a cursor of the given age: full while fresh, then easing to 0 as it
 * approaches the ttl, so a cursor fades out gracefully instead of blinking away.
 */
export function cursorOpacity(age: number, ttl = CURSOR_TTL): number {
  const fadeStart = ttl * 0.5;
  if (age <= fadeStart) return 1;
  if (age >= ttl) return 0;
  return 1 - (age - fadeStart) / (ttl - fadeStart);
}

/**
 * A stable, pleasant colour derived from a view id, so each person's cursor keeps
 * the same hue across updates without any server-assigned palette.
 */
export function cursorColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 60%)`;
}
