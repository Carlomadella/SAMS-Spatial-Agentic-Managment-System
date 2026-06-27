/** Normalized event the runtime streams to the SAMS browser UI over SSE. */
export interface WireEvent {
  /** SAMS agent id this update belongs to. */
  agentId: string;
  agentName: string;
  level?: "INFO" | "SUCCESS" | "WARN" | "ERROR" | "IDLE";
  message?: string;
  status?: "idle" | "working" | "review" | "blocked" | "done";
  /** 0..100 */
  progress?: number;
  /** cumulative Gemini tokens used by this task (sent once on completion) */
  tokens?: number;
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
