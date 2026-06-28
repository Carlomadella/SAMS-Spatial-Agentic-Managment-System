import type { Agent, WorkflowDef } from "../types";
import type { FlatFile } from "./fileTree";

export interface SearchResult {
  kind: "agent" | "workflow" | "file";
  key: string;
  label: string;
  sublabel: string;
  /** set on agent results so the UI can select the agent on click */
  agentId?: string;
  /** set on workflow results so the UI can open its runner */
  workflowId?: string;
}

/**
 * Case-insensitive substring search across the workspace. Pure and ordered:
 * agents first (name / role / current task), then workflows (name /
 * description), then files (full path). Returns at most `limit` results.
 */
export function searchWorkspace(
  query: string,
  agents: Agent[],
  workflows: WorkflowDef[],
  files: FlatFile[],
  limit = 30,
): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResult[] = [];

  for (const a of agents) {
    const task = a.task?.title ?? "";
    if (
      a.name.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q) ||
      task.toLowerCase().includes(q)
    ) {
      results.push({
        kind: "agent",
        key: a.id,
        label: a.name,
        sublabel: task ? `${a.role} · ${task}` : a.role,
        agentId: a.id,
      });
    }
  }

  for (const w of workflows) {
    if (w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q)) {
      results.push({
        kind: "workflow",
        key: w.id,
        label: w.name,
        sublabel: w.description,
        workflowId: w.id,
      });
    }
  }

  for (const f of files) {
    if (f.path.toLowerCase().includes(q)) {
      results.push({ kind: "file", key: f.id, label: f.name, sublabel: f.path });
    }
  }

  return results.slice(0, limit);
}
