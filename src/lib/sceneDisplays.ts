import type { Agent, AgentColor } from "../types";

// ---------------------------------------------------------------------------
// Pure helpers that turn live agent state into what the 3D furniture "shows":
//   • the studio desk monitor → the file the working agent is writing
//   • the media wall (TV)      → the queue of tasks waiting across all agents
// Kept pure (no three.js) so they can be unit-tested.
// ---------------------------------------------------------------------------

export interface MonitorView {
  agentName: string;
  branch: string;
  /** file path being written, or the branch when still planning */
  path: string;
  lines: string[];
  status: "writing" | "planning";
}

/**
 * What the studio desk monitor renders for the currently working agent: the
 * real staged file content (truncated to `maxLines`, long lines clipped), or —
 * before any file is staged — its announced plan / task title as "thinking".
 * Returns null when nobody is working (the screen goes idle).
 */
export function monitorView(working: Agent | null, maxLines = 7): MonitorView | null {
  if (!working || !working.task) return null;
  const clip = (l: string) => (l.length > 42 ? l.slice(0, 41) + "…" : l);

  const file = working.pendingFiles?.[working.pendingFiles.length - 1];
  if (file) {
    return {
      agentName: working.name,
      branch: working.task.branch,
      path: file.path,
      lines: file.content.split("\n").slice(0, maxLines).map(clip),
      status: "writing",
    };
  }

  const plan = working.task.plan ?? [];
  const lines = plan.length
    ? plan.slice(0, maxLines).map((s, i) => clip(`${i + 1}. ${s}`))
    : [clip(working.task.title)];
  return { agentName: working.name, branch: working.task.branch, path: working.task.branch, lines, status: "planning" };
}

export interface QueueRow {
  agentId: string;
  agentName: string;
  color: AgentColor;
  title: string;
}

/**
 * The "up next" board for the media wall: every queued task across all agents,
 * in agent order, capped at `max` rows.
 */
export function queueBoard(agents: Agent[], max = 6): QueueRow[] {
  const rows: QueueRow[] = [];
  for (const a of agents) {
    for (const q of a.taskQueue ?? []) {
      rows.push({ agentId: a.id, agentName: a.name, color: a.color, title: q.title });
      if (rows.length >= max) return rows;
    }
  }
  return rows;
}
