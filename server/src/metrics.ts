import type { WireEvent } from "./types";

/**
 * Lightweight in-memory runtime metrics, tallied from the event stream. Not
 * persisted (resets on restart) — a cheap step toward observability without a
 * database. `eventDelta` is pure so the classification is unit-testable.
 */
export interface MetricsDelta {
  events: number;
  tasksStarted: number;
  tasksCompleted: number;
  errors: number;
}

/** How a single wire event contributes to the counters. */
export function eventDelta(e: WireEvent): MetricsDelta {
  return {
    events: 1,
    // a task kicks off with status "working" at low progress (the "Avvio" emit)
    tasksStarted: e.status === "working" && (e.progress ?? 100) <= 6 ? 1 : 0,
    tasksCompleted: e.status === "review" || e.status === "done" ? 1 : 0,
    errors: e.level === "ERROR" ? 1 : 0,
  };
}

const totals: MetricsDelta = { events: 0, tasksStarted: 0, tasksCompleted: 0, errors: 0 };
const startedAt = Date.now();

/** Fold one event into the running totals. */
export function recordEvent(e: WireEvent): void {
  const d = eventDelta(e);
  totals.events += d.events;
  totals.tasksStarted += d.tasksStarted;
  totals.tasksCompleted += d.tasksCompleted;
  totals.errors += d.errors;
}

/** Public snapshot for GET /api/metrics. */
export function metricsSnapshot(extra: { clients: number }): MetricsDelta & { uptimeSec: number; clients: number } {
  return { ...totals, uptimeSec: Math.round((Date.now() - startedAt) / 1000), clients: extra.clients };
}
