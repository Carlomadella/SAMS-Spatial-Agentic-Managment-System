import type { PendingFile } from "./types";

export interface PendingWork {
  branch: string;
  title: string;
  agentName: string;
  files: PendingFile[];
}

const buffer = new Map<string, PendingWork>();

export function setPending(agentId: string, work: PendingWork): void {
  buffer.set(agentId, work);
}

export function getPending(agentId: string): PendingWork | undefined {
  return buffer.get(agentId);
}

export function clearPending(agentId: string): void {
  buffer.delete(agentId);
}
