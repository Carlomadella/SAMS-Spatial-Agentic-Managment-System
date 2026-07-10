// Presenza di selezione (Roadmap 4, frontiera #2) — gemella dei cursori live.
// Pure helpers shared by the store (which keeps the incoming selections) and the
// scene (which draws an aura on the agent another view has selected). Like
// cursors, selections are ephemeral: the sender re-posts on a slow heartbeat, so
// a view that disconnects simply goes stale and its aura disappears.

export interface RemoteSelection {
  id: string;
  name: string;
  /** the agent this view has selected, or null when it has deselected. */
  agentId: string | null;
  /** client-side receipt time, used to prune stale selections. */
  ts: number;
}

/** How long a selection lives after its last update before it's dropped (ms).
 *  Comfortably above the sender's heartbeat so an active selection never blinks. */
export const SELECTION_TTL = 6000;

/**
 * Drop selections older than `ttl`. Returns the SAME object when nothing changed
 * so callers can skip a needless state update (and re-render).
 */
export function pruneSelections(
  selections: Record<string, RemoteSelection>,
  now: number,
  ttl = SELECTION_TTL,
): Record<string, RemoteSelection> {
  let changed = false;
  const kept: Record<string, RemoteSelection> = {};
  for (const [id, s] of Object.entries(selections)) {
    if (now - s.ts <= ttl) kept[id] = s;
    else changed = true;
  }
  return changed ? kept : selections;
}

/**
 * Which OTHER views (never `selfId`) currently have `agentId` selected. Used by
 * the scene to decide whether to draw a remote-selection aura on an agent.
 */
export function selectorsOf(
  selections: Record<string, RemoteSelection>,
  agentId: string,
  selfId: string,
): RemoteSelection[] {
  return Object.values(selections).filter((s) => s.id !== selfId && s.agentId === agentId);
}
