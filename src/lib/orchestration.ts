import type { Agent, QueuedTask } from "../types";

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

/** Idle, no active task, and at least one task waiting in the queue. */
export function canStartQueued(a: Pick<Agent, "status" | "task" | "taskQueue">): boolean {
  return a.status === "idle" && !a.task && (a.taskQueue?.length ?? 0) > 0;
}

/**
 * Pick the agent that should take an incoming-webhook "wake" task. Prefers a
 * genuinely idle/empty agent; failing that, the one with the shortest queue so
 * the work still lands somewhere. Returns `undefined` only when there are no
 * agents at all. A specific `branch` slightly favours an agent already named for
 * the same kind of work isn't worth the complexity — we keep it role-agnostic.
 */
export function pickFreeAgent(agents: Agent[]): Agent | undefined {
  if (agents.length === 0) return undefined;
  const free = agents.filter(isIdleEligible);
  if (free.length > 0) {
    // Among free agents, the most rested feels the most "available".
    return free.reduce((best, a) => (a.energy > best.energy ? a : best));
  }
  // Nobody's free: hand it to the least-loaded agent (shortest queue, then idlest).
  return agents.reduce((best, a) => {
    const load = (x: Agent) => (x.task ? 1 : 0) + (x.taskQueue?.length ?? 0);
    return load(a) < load(best) ? a : best;
  });
}

/**
 * Inserisce un task nella coda rispettando la priorità: un task **urgente** salta
 * davanti a quelli normali, ma resta in coda (FIFO) rispetto agli altri urgenti già
 * presenti; un task normale va in fondo. La coda si consuma sempre dall'indice 0,
 * quindi questo ordinamento basta a far servire prima gli urgenti — senza toccare
 * `shiftQueue` né il bridge. Immutabile.
 */
export function enqueueOrdered(queue: QueuedTask[], task: QueuedTask): QueuedTask[] {
  if (!task.urgent) return [...queue, task];
  // inserisci dopo il blocco iniziale di urgenti (preserva l'ordine tra urgenti)
  let i = 0;
  while (i < queue.length && queue[i].urgent) i++;
  return [...queue.slice(0, i), task, ...queue.slice(i)];
}

/**
 * Should the queue bridge auto-start the next task? True on the transition INTO
 * idle (so we react once, not every tick) while a queued task is waiting.
 */
export function shouldAutoStartQueue(
  agent: Pick<Agent, "status" | "task" | "taskQueue">,
  prev: Pick<Agent, "status"> | undefined,
): boolean {
  return canStartQueued(agent) && prev?.status !== "idle";
}
