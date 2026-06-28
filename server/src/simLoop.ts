/** Server-side state for Live Simulation mode. */

interface ClaimEntry {
  agentId: string;
  claimedAt: number;
}

const _claimed = new Map<number, ClaimEntry>();
let _enabled = false;
let _label = "sams";

/**
 * A claim older than this is treated as stale (the agent crashed, the page was
 * closed, or the client never released it) and may be taken over by another
 * agent. Without this, a wedged agent would burn an issue slot forever.
 */
export const CLAIM_TTL_MS = 30 * 60_000; // 30 minutes

export function simEnabled(): boolean {
  return _enabled;
}

export function startSim(label = "sams"): void {
  _enabled = true;
  _label = label;
}

export function stopSim(): void {
  _enabled = false;
  _claimed.clear();
}

export function getSimLabel(): string {
  return _label;
}

/**
 * Atomically claim issueNumber for agentId.
 * Node.js is single-threaded — the Map check + set is effectively atomic.
 * Returns false if already claimed by another agent (unless that claim is
 * stale, in which case it is taken over).
 */
export function claimIssue(issueNumber: number, agentId: string): boolean {
  const existing = _claimed.get(issueNumber);
  if (existing && Date.now() - existing.claimedAt < CLAIM_TTL_MS) return false;
  _claimed.set(issueNumber, { agentId, claimedAt: Date.now() });
  return true;
}

/**
 * Release a claim. When agentId is provided, the claim is only released if that
 * agent actually owns it — this prevents a late/duplicate release from one agent
 * from stealing an issue another agent has since legitimately re-claimed.
 */
export function releaseIssue(issueNumber: number, agentId?: string): void {
  if (agentId !== undefined) {
    const entry = _claimed.get(issueNumber);
    if (entry && entry.agentId !== agentId) return; // not the owner — ignore
  }
  _claimed.delete(issueNumber);
}

/** Release whichever issue this agent holds; returns its number (or undefined). */
export function releaseByAgent(agentId: string): number | undefined {
  for (const [num, entry] of _claimed) {
    if (entry.agentId === agentId) {
      _claimed.delete(num);
      return num;
    }
  }
  return undefined;
}

export function getClaims(): ReadonlyMap<number, ClaimEntry> {
  return _claimed;
}

export function simStatus(): { enabled: boolean; label: string; claimedCount: number } {
  return { enabled: _enabled, label: _label, claimedCount: _claimed.size };
}
