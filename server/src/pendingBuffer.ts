import type { PendingFile } from "./types";

export interface PendingWork {
  branch: string;
  title: string;
  agentName: string;
  files: PendingFile[];
  createdAt: number;
}

const buffer = new Map<string, PendingWork>();
const MAX_ENTRIES = 50;
const TTL_MS = 60 * 60 * 1000; // staged files expire after 1h if never approved/rejected

/** Drop entries older than the TTL so unapproved file contents don't pile up. */
function sweep(): void {
  const now = Date.now();
  for (const [id, work] of buffer) {
    if (now - work.createdAt > TTL_MS) buffer.delete(id);
  }
}

export function setPending(agentId: string, work: Omit<PendingWork, "createdAt">): void {
  sweep();
  // Cap total entries: evict the oldest if we're at capacity and this is new.
  if (!buffer.has(agentId) && buffer.size >= MAX_ENTRIES) {
    let oldestId: string | undefined;
    let oldestAt = Infinity;
    for (const [id, w] of buffer) {
      if (w.createdAt < oldestAt) { oldestAt = w.createdAt; oldestId = id; }
    }
    if (oldestId) buffer.delete(oldestId);
  }
  buffer.set(agentId, { ...work, createdAt: Date.now() });
}

export function getPending(agentId: string): PendingWork | undefined {
  const work = buffer.get(agentId);
  if (work && Date.now() - work.createdAt > TTL_MS) {
    buffer.delete(agentId);
    return undefined;
  }
  return work;
}

export function clearPending(agentId: string): void {
  buffer.delete(agentId);
}
