import type { Agent } from "../types";

/** A relay request emitted by an agent's `relay_task` tool, queued in the store. */
export interface RelayRequest {
  target: string;
  title: string;
  branch: string;
  context: string;
  fromName: string;
  fromId: string;
}

/**
 * Resolve which agent a relay should be handed to: an exact role match or an
 * agent whose name contains the target (case-insensitive). An empty/blank
 * target matches nobody (returning `undefined`) rather than the first agent.
 */
export function findRelayTarget(agents: Agent[], target: string): Agent | undefined {
  const t = target.trim().toLowerCase();
  if (!t) return undefined;
  return agents.find((a) => a.role.toLowerCase() === t || a.name.toLowerCase().includes(t));
}

/** Title shown to the relay target, folding in the sender's context (capped). */
export function composeRelayTitle(relay: Pick<RelayRequest, "title" | "context" | "fromName">): string {
  return relay.context
    ? `${relay.title} [da ${relay.fromName}: ${relay.context.slice(0, 80)}]`
    : relay.title;
}

/**
 * An agent is "idle-eligible" — genuinely free to take a queued task or wander
 * to the lounge — when it's idle with no active task and an empty queue.
 */
export function isIdleEligible(a: Pick<Agent, "status" | "task" | "taskQueue">): boolean {
  return a.status === "idle" && !a.task && !(a.taskQueue?.length);
}
