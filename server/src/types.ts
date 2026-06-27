/** A file the agent wants to commit, held for user approval when requireApproval is on. */
export interface PendingFile {
  path: string;
  content: string;
  message: string;
}

/** Normalized event the runtime streams to the SAMS browser UI over SSE. */
export interface WireEvent {
  /** SAMS agent id this update belongs to. */
  agentId: string;
  agentName: string;
  level?: "INFO" | "SUCCESS" | "WARN" | "ERROR" | "IDLE";
  message?: string;
  status?: "idle" | "working" | "review" | "blocked" | "done" | "awaiting_approval";
  /** 0..100 */
  progress?: number;
  /** cumulative tokens used by this task (sent once on completion) */
  tokens?: number;
  /** file contents staged for approval (sent with status = awaiting_approval) */
  pendingFiles?: PendingFile[];
}

export interface AssignBody {
  agentId: string;
  agentName?: string;
  title: string;
  branch?: string;
  /** Agent role that shapes the system prompt (e.g. "Revisore", "Tester"). */
  role?: string;
  /** Standing instructions set by the user in the inspector; injected verbatim into the system prompt. */
  instructions?: string;
}
