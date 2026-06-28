import type { LogEvent } from "../types";

export type OutputKind = "head" | "ok" | "err" | "warn";
export interface OutputLine {
  kind: OutputKind;
  text: string;
}

export interface RuntimeStatus {
  backendOnline: boolean;
  runtimeReady: boolean;
  agentCount: number;
}

/**
 * Derive a build/runtime "Output console" from real workspace state: a short
 * status header plus the stream of result-bearing events (SUCCESS / WARN /
 * ERROR), formatted like CI output. Distinct from the Event Log, which is the
 * full per-agent activity feed.
 */
export function buildOutputLines(
  events: LogEvent[],
  status: RuntimeStatus,
  limit = 100,
): OutputLine[] {
  const head: OutputLine[] = [
    {
      kind: "head",
      text: `[runtime] ${status.backendOnline ? "connected" : "offline — local sandbox"}`,
    },
    {
      kind: "head",
      text: `[runtime] ${status.agentCount} agent slot${status.agentCount === 1 ? "" : "s"} active`,
    },
    status.runtimeReady
      ? { kind: "ok", text: "[ready] workspace online · SAMS connected" }
      : { kind: "warn", text: "[waiting] runtime not provisioned — configure keys in Settings" },
  ];

  const stream = events
    .filter((e) => e.level === "SUCCESS" || e.level === "ERROR" || e.level === "WARN")
    .slice(-limit)
    .map((e): OutputLine => ({
      kind: e.level === "SUCCESS" ? "ok" : e.level === "ERROR" ? "err" : "warn",
      text: `[${e.level.toLowerCase()}] ${e.agentName}: ${e.message}`,
    }));

  return [...head, ...stream];
}
