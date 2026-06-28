/** Server-side state for Live Simulation mode. */

interface ClaimEntry {
  agentId: string;
  claimedAt: number;
}

const _claimed = new Map<number, ClaimEntry>();
let _enabled = false;
let _label = "sams";

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
 * Returns false if already claimed by another agent.
 */
export function claimIssue(issueNumber: number, agentId: string): boolean {
  if (_claimed.has(issueNumber)) return false;
  _claimed.set(issueNumber, { agentId, claimedAt: Date.now() });
  return true;
}

export function releaseIssue(issueNumber: number): void {
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
