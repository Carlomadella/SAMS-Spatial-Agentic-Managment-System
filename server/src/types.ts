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
  /** agent-to-agent handoff: ask a peer to continue the work */
  relayTo?: { target: string; title: string; branch: string; context: string };
  /** step-by-step plan the agent announced before starting work */
  plan?: string[];
  /** "wake": a contextual task for the UI to assign to a free agent. `source`
   *  distinguishes a webhook wake (gated by the user's opt-in toggle) from a
   *  scheduled-routine wake (always assigned — the routine itself is the opt-in). */
  wake?: { title: string; branch?: string; reason: string; source?: "webhook" | "routine" };
  /** "presence": number of connected views (SSE clients), broadcast on connect/
   *  disconnect. Carries no agent state — the UI only reads the count. */
  presence?: number;
  /** presence: distinct names of who is watching. */
  people?: string[];
  /** "chat": a workspace chat message, broadcast to every connected view. */
  chat?: { id: string; author: string; text: string; ts: number };
  /** "world": the authoritative world snapshot, broadcast live after a POST
   *  /api/world so other views adopt it immediately instead of waiting for their
   *  next pull (Roadmap 4 — presence realtime / agenti live). */
  world?: { agents: unknown[]; version: number; updatedAt: number };
  /** "cursor": a live presence cursor — where another view is pointing on the
   *  floor. Ephemeral (never persisted), broadcast on the SSE channel so views
   *  see each other's pointers in the shared world (Roadmap 4, frontiera #2). */
  cursor?: { id: string; name: string; x: number; z: number; ts: number };
  /** "selection": which agent another view has selected (or null = none).
   *  Ephemeral like `cursor` — broadcast so views see each other's focus as an
   *  aura on the agent (Roadmap 4, frontiera #2). */
  selection?: { id: string; name: string; agentId: string | null; ts: number };
  /** "driver": who currently holds the authoritative driver lease (opzione B3),
   *  or holderId "" when no view is driving. Broadcast on handover. */
  driver?: { holderId: string; name: string };
  /** "worldsim": live agent positions pushed by the driver so follower views
   *  animate the same shared movement (Roadmap 4, opzione B3). Ephemeral, only
   *  the lease holder may push. */
  worldsim?: { agents: { id: string; x: number; z: number; tx: number | null; tz: number | null }[]; ts: number };
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
  /** Per-task GitHub repo override (owner/repo). Used by the "meta-agente" to
   *  target SAMS itself instead of the globally configured repository. */
  repo?: string;
  /** Nome della vista che ha avviato l'azione (attribuzione nel log; non fidato). */
  actor?: string;
}
