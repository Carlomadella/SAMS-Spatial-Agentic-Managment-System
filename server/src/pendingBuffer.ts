import type { PendingFile } from "./types";
import type { GithubContext } from "./github";

export interface PendingWork {
  branch: string;
  title: string;
  agentName: string;
  files: PendingFile[];
  /** il task scrive sul branch principale: i file vanno lì solo con la conferma di una persona */
  toMain?: boolean;
  /** merge di una PR chiesto dall'agente, da eseguire solo dopo la conferma */
  merge?: { prNumber: number; method: "merge" | "squash" | "rebase"; headSha: string; headRef: string; baseRef: string; title: string };
  /** Repo, token e branch base del task: chi approva committa lì, non sulla repo del server. */
  github?: GithubContext;
  createdAt: number;
}

const buffer = new Map<string, PendingWork>();
const MAX_ENTRIES = 50;
const TTL_MS = 60 * 60 * 1000; // staged files expire after 1h if never approved/rejected
/** Push o merge sul branch principale: l'agente resta in sala d'attesa più a lungo. */
const GATE_TTL_MS = 24 * 60 * 60 * 1000;

function ttlOf(work: Pick<PendingWork, "toMain" | "merge">): number {
  return work.toMain || work.merge ? GATE_TTL_MS : TTL_MS;
}

/** L'agente aspetta una conferma per il branch principale (push o merge). */
export function isMainGate(work: PendingWork | undefined): boolean {
  return !!work && (!!work.toMain || !!work.merge);
}

/** Drop entries older than the TTL so unapproved file contents don't pile up. */
function sweep(): void {
  const now = Date.now();
  for (const [id, work] of buffer) {
    if (now - work.createdAt > ttlOf(work)) buffer.delete(id);
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
  if (work && Date.now() - work.createdAt > ttlOf(work)) {
    buffer.delete(agentId);
    return undefined;
  }
  return work;
}

/** Tutto quello che aspetta una persona, dal più vecchio (Reparto revisioni). */
export function listPending(): Array<PendingWork & { agentId: string }> {
  sweep();
  return [...buffer.entries()]
    .map(([agentId, w]) => ({ ...w, agentId }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function clearPending(agentId: string): void {
  buffer.delete(agentId);
}
