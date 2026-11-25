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
  /** testo tecnico dietro a un messaggio d'errore tradotto («Dettagli» richiudibile nella UI) */
  detail?: string;
  status?: "idle" | "working" | "review" | "blocked" | "done" | "awaiting_approval";
  /** 0..100 */
  progress?: number;
  /** Stanze iconiche: che azione sta facendo l'agente (read → Biblioteca, write → Officina, test → Laboratorio). */
  activity?: "read" | "write" | "test";
  /** esito dei test letto dalla CI (lampada del Laboratorio) */
  ci?: "success" | "failure";
  /** cumulative tokens used by this task (sent once on completion) */
  tokens?: number;
  /** file contents staged for approval (sent with status = awaiting_approval) */
  pendingFiles?: PendingFile[];
  /** merge chiesto dall'agente: un agente non mergia mai da solo, aspetta la conferma
   *  di una persona (sent with status = awaiting_approval). */
  pendingMerge?: { prNumber: number; method: "merge" | "squash" | "rebase"; headSha: string; headRef: string; baseRef: string; title: string };
  /** workflow da avviare quando una persona approva (approvazione obbligatoria) */
  pendingWorkflow?: { workflow: string; ref: string };
  /** l'attesa riguarda il branch principale (push o merge): l'agente è bloccato nella
   *  sala d'attesa finché una persona non conferma o rifiuta. */
  mainGate?: boolean;
  /** permesso chiesto a una persona ("Chiedi prima", idea 2): l'agente è fermo finché non si decide; null = richiesta chiusa */
  permissionRequest?: { id: string; group: string; groupLabel: string; tool: string; detail: string; since: number } | null;
  /** agent-to-agent handoff: ask a peer to continue the work */
  relayTo?: { target: string; title: string; branch: string; context: string };
  /** risultato completo del task (riassunto finale), mostrato nell'Inspector */
  result?: { title: string; summary: string };
  /** step-by-step plan the agent announced before starting work */
  plan?: string[];
  /** branch su cui il task lavora davvero (annunciato all'avvio, così la UI non mostra "main") */
  branch?: string;
  /** "wake": a contextual task for the UI to assign to a free agent. `source`
   *  distinguishes a webhook wake (gated by the user's opt-in toggle) from a
   *  scheduled-routine wake (always assigned — the routine itself is the opt-in). */
  wake?: { title: string; branch?: string; reason: string; source?: "webhook" | "routine" };
  /** "engine": stato del motore AI (in uso, riserva o quote finite) per la barra in basso */
  engine?: { provider: string; mode: "ok" | "fallback" | "exhausted"; since: number };
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
  /** Ambiente scelto in UI ("dev" | "staging" | "prod"): il server lo traduce nel branch base
   *  impostato per quell'ambiente. Valori ignoti o ambienti senza branch si ignorano. */
  environment?: string;
  /** Nome della vista che ha avviato l'azione (attribuzione nel log; non fidato). */
  actor?: string;
}
