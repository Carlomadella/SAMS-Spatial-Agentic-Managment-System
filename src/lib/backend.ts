import type { AgentStatus, LogLevel, PendingFile } from "../types";
import { useStore } from "../store/useStore";
import { normalizeRole, type ViewerRole } from "./roleUi";

// The runtime backend (SAMS ↔ agents). By default the app calls the SAME origin
// (`/api/...`), which Vite proxies to the local runtime — so the browser never
// makes a cross-origin request and CORS can't get in the way. Override with an
// absolute VITE_SAMS_BACKEND_URL only if you host the runtime elsewhere.
export const BASE = ((import.meta.env.VITE_SAMS_BACKEND_URL as string | undefined) ?? "").replace(/\/$/, "");

export const backendEnabled = true;

/**
 * Header per le richieste al runtime. Se l'utente è loggato sul sito (auth reale), allega
 * il **token di sessione** come `Authorization: Bearer …`, così il server fa valere il suo
 * ruolo (owner/editor/viewer) anche nella workspace. Senza login → nessun token, il runtime
 * ricade sui token statici da env (dev aperto = owner). `json` aggiunge il Content-Type.
 */
export function authHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  let token = "";
  try {
    token = localStorage.getItem("sams.site.token") ?? "";
  } catch {
    /* localStorage non disponibile → nessun token */
  }
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export interface RemoteUpdate {
  agentId: string;
  agentName?: string;
  status?: AgentStatus;
  progress?: number;
  level?: LogLevel;
  message?: string;
  /** cumulative Gemini tokens for the task (sent once on completion) */
  tokens?: number;
  pendingFiles?: PendingFile[];
  relayTo?: { target: string; title: string; branch: string; context: string };
  plan?: string[];
  wake?: { title: string; branch?: string; reason: string; source?: "webhook" | "routine" };
  /** Presence: number of connected views, broadcast by the runtime on connect/disconnect. */
  presence?: number;
  /** Presence: distinct names of who is watching (may be absent on old runtimes). */
  people?: string[];
  /** Chat: a workspace chat message broadcast by the runtime. */
  chat?: { id: string; author: string; text: string; ts: number };
  /** World: authoritative snapshot broadcast live after another view saved it. */
  world?: { agents: WorldAgentSnapshot[]; version: number; updatedAt: number };
  /** Cursor: a live presence cursor from another view (frontiera #2). */
  cursor?: { id: string; name: string; x: number; z: number; ts: number };
  /** Selection: which agent another view has selected, or null (frontiera #2). */
  selection?: { id: string; name: string; agentId: string | null; ts: number };
  /** Driver: who holds the authoritative driver lease, "" = none (opzione B3). */
  driver?: { holderId: string; name: string };
  /** Worldsim: the driver's live agent positions, adopted read-only by followers
   *  so everyone sees the same shared movement (opzione B3). */
  worldsim?: { agents: { id: string; x: number; z: number; tx: number | null; tz: number | null; energy?: number; hunger?: number }[]; ts: number };
}

export type Provider = "gemini" | "claude" | "groq" | "openrouter" | "openai";

export interface RuntimeStatus {
  provider: Provider;
  hasGeminiKey: boolean;
  hasAnthropicKey: boolean;
  hasGroqKey: boolean;
  hasOpenrouterKey: boolean;
  hasOpenaiKey: boolean;
  hasGithubToken: boolean;
  provisioned: boolean;
  ready: boolean;
  repo: string;
  baseBranch: string;
  model: string;
  openPRs: boolean;
  requireApproval: boolean;
  hasNotionToken: boolean;
  notionPageId: string;
  notionReady: boolean;
}

export interface SettingsInput {
  provider?: Provider;
  geminiApiKey?: string;
  anthropicApiKey?: string;
  groqApiKey?: string;
  openrouterApiKey?: string;
  openaiApiKey?: string;
  githubToken?: string;
  githubRepo?: string;
  baseBranch?: string;
  model?: string;
  openPRs?: boolean;
  requireApproval?: boolean;
  notionToken?: string;
  notionPageId?: string;
}

export interface RuntimeMetrics {
  events: number;
  tasksStarted: number;
  tasksCompleted: number;
  errors: number;
  uptimeSec: number;
  clients: number;
  /** cumulative chat messages that flowed through the shared workspace */
  chatMessages?: number;
  /** high-water mark of simultaneously connected views */
  peakClients?: number;
  /** cumulative, durable totals from the task log (survive restarts) */
  lifetime?: { total: number; completed: number; tokens: number };
}

export interface TaskHistoryRow {
  agentId: string;
  agentName: string;
  title: string;
  branch: string;
  status: string;
  tokens: number;
  ts: number;
}

/** Current repo content of a file (the "before" of a staged diff); "" if new/unreachable. */
export async function fetchFile(path: string, ref?: string): Promise<{ content: string; exists: boolean }> {
  try {
    const q = new URLSearchParams({ path, ...(ref ? { ref } : {}) });
    const res = await fetch(`${BASE}/api/file?${q.toString()}`);
    if (!res.ok) return { content: "", exists: false };
    return (await res.json()) as { content: string; exists: boolean };
  } catch {
    return { content: "", exists: false };
  }
}

/** Read-only snapshot of the world for the shareable public dashboard. */
export interface PublicSnapshot {
  generatedAt: number;
  runtime: { provider: string; ready: boolean; repo: string; baseBranch: string; model: string };
  metrics: {
    tasksStarted: number;
    tasksCompleted: number;
    errors: number;
    uptimeSec: number;
    lifetimeTasks: number;
    lifetimeCompleted: number;
    lifetimeTokens: number;
  };
  garden: {
    contributors: number;
    totalWaterings: number;
    top: { user: string; stage: string; growth: number; waterings: number }[];
  };
  /** Riepilogo del mondo autorevole durevole (può mancare da runtime vecchi). */
  world?: { agents: number; working: number; idle: number };
  /** Quante viste stanno guardando ora (può mancare da runtime vecchi). */
  viewers?: number;
}

/** Fetch the public read-only snapshot; null if unreachable or unauthorized. */
export async function fetchPublicSnapshot(token?: string): Promise<PublicSnapshot | null> {
  try {
    const q = token ? `?token=${encodeURIComponent(token)}` : "";
    const res = await fetch(`${BASE}/api/public${q}`);
    if (!res.ok) return null;
    return (await res.json()) as PublicSnapshot;
  } catch {
    return null;
  }
}

/** Recent finished tasks from the runtime's durable log (empty if unreachable). */
export async function fetchHistory(): Promise<TaskHistoryRow[]> {
  try {
    const res = await fetch(`${BASE}/api/history`);
    if (!res.ok) return [];
    return (await res.json()) as TaskHistoryRow[];
  } catch {
    return [];
  }
}

/** Read the runtime's in-memory metrics (null if the runtime is unreachable). */
export async function fetchMetrics(): Promise<RuntimeMetrics | null> {
  try {
    const res = await fetch(`${BASE}/api/metrics`);
    if (!res.ok) return null;
    return (await res.json()) as RuntimeMetrics;
  } catch {
    return null;
  }
}

/** Read the runtime status (which keys are set, whether agents are provisioned). */
export async function fetchStatus(): Promise<RuntimeStatus | null> {
  try {
    const res = await fetch(`${BASE}/api/status`);
    if (!res.ok) return null;
    return (await res.json()) as RuntimeStatus;
  } catch {
    return null;
  }
}

/** Ruolo del chiamante sul workspace (Roadmap 4, frontiera #2). `enforced` è false
 *  in dev aperto (nessun token configurato) → tutti owner, nessun badge in UI. */
export interface WhoAmI {
  role: ViewerRole;
  enforced: boolean;
  /** nome dell'account loggato ("" se non autenticato o runtime vecchio) */
  name: string;
  /** email dell'account loggato ("" se non autenticato) */
  email: string;
}

/** Chiedi al runtime il ruolo del chiamante; fallback a owner/dev-aperto quando
 *  irraggiungibile o su un runtime vecchio senza l'endpoint. */
export async function fetchWhoami(): Promise<WhoAmI> {
  try {
    const res = await fetch(`${BASE}/api/whoami`, { headers: authHeaders(false) });
    if (!res.ok) return { role: "owner", enforced: false, name: "", email: "" };
    const data = (await res.json()) as { role?: unknown; enforced?: unknown; name?: unknown; email?: unknown };
    return {
      role: normalizeRole(data.role),
      enforced: Boolean(data.enforced),
      name: typeof data.name === "string" ? data.name : "",
      email: typeof data.email === "string" ? data.email : "",
    };
  } catch {
    return { role: "owner", enforced: false, name: "", email: "" };
  }
}

/** Un account come lo vede l'owner nella gestione utenti. */
export interface ManagedUser {
  email: string;
  name: string;
  role: ViewerRole;
  createdAt: number;
  /** L'indirizzo è stato confermato via link? (gestione password, 2026-07-15) */
  emailVerified?: boolean;
}

/** Elenca gli utenti (solo owner). Vuoto se non autorizzato o irraggiungibile. */
export async function fetchUsers(): Promise<ManagedUser[]> {
  try {
    const res = await fetch(`${BASE}/api/auth/users`, { headers: authHeaders(false) });
    if (!res.ok) return [];
    const body = (await res.json()) as { users?: ManagedUser[] };
    return body.users ?? [];
  } catch {
    return [];
  }
}

/** Cambia la password del proprio account (verifica la vecchia). Slogga gli altri dispositivi. */
export async function changePasswordRemote(oldPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/api/auth/password`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Cambio password non riuscito" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Runtime non raggiungibile" };
  }
}

// --- Gestione password: reset + verifica email (doc di decisione 2026-07-15) ---

/**
 * "Password dimenticata": chiede al server un link di reset. Risponde `ok` **sempre**,
 * anche per un'email inesistente — il server non rivela chi ha un account, e la UI non
 * deve tradire la differenza mostrando un errore.
 */
export async function forgotPasswordRemote(email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/api/auth/forgot`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Richiesta non riuscita" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Runtime non raggiungibile" };
  }
}

/** Reimposta la password spendendo il token del link (nessuna sessione richiesta). */
export async function resetPasswordRemote(token: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/api/auth/reset`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ token, password }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Reset non riuscito" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Runtime non raggiungibile" };
  }
}

/** Conferma l'indirizzo email col token del link di verifica. */
export async function verifyEmailRemote(token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/api/auth/verify`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Verifica non riuscita" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Runtime non raggiungibile" };
  }
}

/** Richiede un nuovo link di verifica per il proprio indirizzo (serve una sessione). */
export async function resendVerificationRemote(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/api/auth/verify/resend`, { method: "POST", headers: authHeaders(false) });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Invio non riuscito" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Runtime non raggiungibile" };
  }
}

/**
 * L'owner emette un link di reset per un altro account e se lo fa restituire, per
 * consegnarlo a mano. È la via di rientro quando SAMS gira senza canale email.
 */
export async function issueUserResetLink(email: string): Promise<{ ok: boolean; link?: string; error?: string }> {
  try {
    const res = await fetch(`${BASE}/api/auth/users/reset`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email }),
    });
    const body = (await res.json().catch(() => ({}))) as { link?: string; error?: string };
    if (!res.ok) return { ok: false, error: body.error ?? "Emissione del link non riuscita" };
    return { ok: true, link: body.link };
  } catch {
    return { ok: false, error: "Runtime non raggiungibile" };
  }
}

/** Cambia il ruolo di un utente (solo owner). */
export async function setUserRoleRemote(email: string, role: ViewerRole): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/api/auth/users/role`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email, role }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Aggiornamento non riuscito" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Runtime non raggiungibile" };
  }
}

/** Fetch status and reflect `ready` into the store (drives the banner). */
export async function refreshRuntimeStatus(): Promise<RuntimeStatus | null> {
  const st = await fetchStatus();
  useStore.getState().setRuntimeReady(!!st?.ready);
  return st;
}

/** Save settings (keys, repo, model…) entered in the app. */
export async function saveSettings(input: SettingsInput): Promise<RuntimeStatus> {
  const res = await fetch(`${BASE}/api/settings`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
  return (await res.json()) as RuntimeStatus;
}

/** Create (or re-create) the managed Agent + Environment. */
export async function provisionAgents(): Promise<RuntimeStatus> {
  const res = await fetch(`${BASE}/api/provision`, { method: "POST", headers: authHeaders(false) });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) msg = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as RuntimeStatus;
}

/** Ask the runtime to have a real managed agent work on a task. */
export async function assignRemote(
  agentId: string,
  agentName: string,
  title: string,
  branch?: string,
  role?: string,
  instructions?: string,
  repo?: string,
): Promise<void> {
  const res = await fetch(`${BASE}/api/assign`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ agentId, agentName, title, branch, role, instructions, repo, actor: viewerName() }),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) msg = data.error;
    } catch {
      const detail = await res.text().catch(() => "");
      if (detail) msg = detail;
    }
    throw new Error(msg);
  }
}

/** Approve staged files — triggers branch creation, commits and optional PR. */
export async function approveChanges(agentId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/approve/${encodeURIComponent(agentId)}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ actor: viewerName() }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
}

/** Reject staged files — clears the buffer, agent goes idle. */
export async function rejectChanges(agentId: string): Promise<void> {
  await fetch(`${BASE}/api/reject/${encodeURIComponent(agentId)}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ actor: viewerName() }),
  });
}

// --- Live Simulation mode ------------------------------------------------

export interface SimIssueRemote {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  labels: string[];
  claimedBy?: string;
}

export interface SimStatusRemote {
  enabled: boolean;
  label: string;
  claimedCount: number;
}

/** Read the server's authoritative Live Sim state (so client and server agree
 *  after a reload or reconnect). Returns null if unreachable. */
export async function fetchSimStatus(): Promise<SimStatusRemote | null> {
  try {
    const res = await fetch(`${BASE}/api/sim/status`);
    if (!res.ok) return null;
    return (await res.json()) as SimStatusRemote;
  } catch {
    return null;
  }
}

/** Start Live Sim mode on the server. */
export async function startSimMode(label = "sams"): Promise<void> {
  await fetch(`${BASE}/api/sim/start`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ label }),
  });
}

/** Stop Live Sim mode on the server. */
export async function stopSimMode(): Promise<void> {
  await fetch(`${BASE}/api/sim/stop`, { method: "POST", headers: authHeaders(false) });
}

/** Fetch open issues available for the Live Sim (with claim info). */
export async function fetchSimIssues(): Promise<SimIssueRemote[]> {
  try {
    const res = await fetch(`${BASE}/api/sim/issues`);
    if (!res.ok) return [];
    return (await res.json()) as SimIssueRemote[];
  } catch {
    return [];
  }
}

/** Atomically claim an issue for an agent. Returns true if claimed successfully. */
export async function claimSimIssue(issueNumber: number, agentId: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/sim/claim/${issueNumber}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ agentId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Release a previously claimed issue. Passing agentId makes it owner-aware. */
export async function releaseSimIssue(issueNumber: number, agentId?: string): Promise<void> {
  await fetch(`${BASE}/api/sim/release/${issueNumber}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ agentId: agentId ?? "" }),
  }).catch(() => {});
}

/** Release whatever issue an agent holds (robust to a lost issue number). */
export async function releaseSimByAgent(agentId: string): Promise<void> {
  await fetch(`${BASE}/api/sim/release-by-agent/${encodeURIComponent(agentId)}`, {
    method: "POST",
  }).catch(() => {});
}

// --- Stato autorevole del mondo (Roadmap 4, primo slice) ------------------

export interface WorldAgentSnapshot {
  id: string;
  name: string;
  color: string;
  role: string;
  status: string;
  task: string | null;
  progress: number;
  /** Config/identità autorevole a bassa frequenza (opzione B2). */
  model?: string;
  instructions?: string;
  repo?: string;
  xp?: number;
  /** Nome dell'utente che ha assegnato il task corrente (attribuzione multi-utente). */
  assignedBy?: string;
  /** Tombstone autorevole (opzione 1): l'agente è stato cancellato sul server. */
  deleted?: boolean;
}

export interface WorldSnapshotRemote {
  agents: WorldAgentSnapshot[];
  updatedAt: number;
  version: number;
}

/** Read the server's durable authoritative world snapshot (null if unreachable). */
export async function fetchWorld(): Promise<WorldSnapshotRemote | null> {
  try {
    const res = await fetch(`${BASE}/api/world`);
    if (!res.ok) return null;
    return (await res.json()) as WorldSnapshotRemote;
  } catch {
    return null;
  }
}

/** Esito di una push del mondo: la versione autorevole del server, o un conflitto. */
export interface PushWorldResult {
  ok: boolean;
  /** true se il server ha rifiutato per concorrenza (409): la nostra base era obsoleta. */
  conflict: boolean;
  /** versione autorevole corrente del server (dopo il salvataggio, o quella in conflitto). */
  version: number;
  /** true se non siamo riusciti a raggiungere il runtime. */
  offline?: boolean;
  /** Sul conflitto (409) il server allega lo snapshot autorevole: il chiamante lo adotta. */
  remoteAgents?: WorldAgentSnapshot[];
}

/**
 * Push the current world snapshot to the runtime for durable, shareable storage.
 * Concorrenza ottimistica: dichiara la `baseVersion` vista per ultima; se il server
 * l'ha già superata risponde 409 con la versione corrente, così il chiamante concilia.
 */
export async function pushWorld(agents: WorldAgentSnapshot[], baseVersion?: number): Promise<PushWorldResult> {
  try {
    const res = await fetch(`${BASE}/api/world`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ agents, baseVersion }),
    });
    const data = (await res.json().catch(() => ({}))) as { version?: number; agents?: unknown };
    const conflict = res.status === 409;
    // Sul 200 `agents` è un *conteggio* (summarizeWorld); solo sul 409 è l'array
    // autorevole da adottare. Leggiamolo perciò esclusivamente in conflitto.
    const remoteAgents = conflict && Array.isArray(data.agents) ? (data.agents as WorldAgentSnapshot[]) : undefined;
    return { ok: res.ok, conflict, version: Number(data.version ?? baseVersion ?? 0), remoteAgents };
  } catch {
    return { ok: false, conflict: false, version: baseVersion ?? 0, offline: true };
  }
}

// --- Chat di workspace (mondo condiviso) ---------------------------------

export interface ChatMessageRemote {
  id: string;
  author: string;
  text: string;
  ts: number;
}

/** Read the recent workspace chat (oldest-first); empty if unreachable. */
export async function fetchChat(): Promise<ChatMessageRemote[]> {
  try {
    const res = await fetch(`${BASE}/api/chat`);
    if (!res.ok) return [];
    return (await res.json()) as ChatMessageRemote[];
  } catch {
    return [];
  }
}

/** Post a chat message; the runtime broadcasts it back over SSE to every view. */
export async function sendChat(author: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ author, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// --- Routine / trigger temporali -----------------------------------------

export interface RoutineRemote {
  id: string;
  name: string;
  title: string;
  branch: string;
  kind: "interval" | "daily";
  intervalMin: number;
  atHour: number;
  atMin: number;
  enabled: boolean;
  lastRun: number;
  /** human-readable schedule, e.g. "ogni giorno alle 09:00" */
  schedule: string;
}

export interface RoutineDraft {
  name: string;
  title: string;
  branch?: string;
  kind: "interval" | "daily";
  intervalMin?: number;
  atHour?: number;
  atMin?: number;
}

/** List the runtime's scheduled routines (empty if unreachable). */
export async function fetchRoutines(): Promise<RoutineRemote[]> {
  try {
    const res = await fetch(`${BASE}/api/routines`);
    if (!res.ok) return [];
    return (await res.json()) as RoutineRemote[];
  } catch {
    return [];
  }
}

/** Create a routine; returns the stored routine or throws with the server error. */
export async function createRoutine(draft: RoutineDraft): Promise<RoutineRemote> {
  const res = await fetch(`${BASE}/api/routines`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(draft),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as RoutineRemote;
}

export async function toggleRoutine(id: string, enabled: boolean): Promise<void> {
  await fetch(`${BASE}/api/routines/${encodeURIComponent(id)}/toggle`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ enabled }),
  }).catch(() => {});
}

export async function deleteRoutine(id: string): Promise<void> {
  await fetch(`${BASE}/api/routines/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeaders(false) }).catch(() => {});
}

export interface MemoryEntry { key: string; value: string; updatedAt: number }

export async function fetchMemory(agentId: string): Promise<MemoryEntry[]> {
  const res = await fetch(`${BASE}/api/memory/${encodeURIComponent(agentId)}`);
  if (!res.ok) return [];
  return (await res.json()) as MemoryEntry[];
}

export async function clearMemory(agentId: string): Promise<void> {
  await fetch(`${BASE}/api/memory/${encodeURIComponent(agentId)}`, { method: "DELETE", headers: authHeaders(false) });
}

// --- Presence: identità della vista (mondo condiviso, Roadmap 4) ----------
// Ogni vista ha un id stabile persistito localmente: così due schede della stessa
// persona si deduplicano nei nomi, pur restando due "viste". Il nome riusa quello
// scelto in chat (`chatName`), con fallback "Ospite".
const VIEWER_ID_KEY = "sams-viewer-id";

export function getViewerId(): string {
  try {
    let id = localStorage.getItem(VIEWER_ID_KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? `v-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(VIEWER_ID_KEY, id);
    }
    return id;
  } catch {
    return "anon"; // localStorage/crypto non disponibili — resta anonimo stabile
  }
}

function viewerName(): string {
  const s = useStore.getState();
  // Precedenza: nome scelto a mano in chat → nome dell'account loggato → "Ospite".
  // Così due utenti loggati compaiono col loro vero nome (presence/cursori/selezioni/
  // chat/attribuzione azioni) invece che tutti come "Ospite".
  return s.chatName?.trim() || s.accountName?.trim() || "Ospite";
}

/**
 * Rinomina la vista a caldo, senza riconnettersi (canale bidirezionale). Best
 * effort: il runtime rimbalza la presence aggiornata a tutte le viste via SSE.
 */
export async function announcePresence(name: string): Promise<void> {
  try {
    await fetch(`${BASE}/api/presence`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: getViewerId(), name: name.trim() || "Ospite" }),
    });
  } catch {
    /* best-effort: la presence non è critica */
  }
}

// Cursori live (frontiera #2): rimbalza la posizione del puntatore sul pavimento
// alle altre viste. Auto-throttle a ~14 update/s (i cursori sono lossy) e best
// effort: se il backend è offline non si tenta nemmeno. Gated "viewer" lato server
// → ogni vista (anche read-only) può mostrarsi, nessun 403 a vuoto.
let lastCursorSent = 0;
export function sendCursor(x: number, z: number): void {
  const now = Date.now();
  if (now - lastCursorSent < 70) return;
  lastCursorSent = now;
  if (!useStore.getState().backendOnline) return;
  void fetch(`${BASE}/api/cursor`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ id: getViewerId(), name: viewerName(), x, z }),
  }).catch(() => {
    /* best-effort: i cursori non sono critici */
  });
}

// Presenza di selezione (frontiera #2): annuncia quale agente questa vista ha
// selezionato (o null). Chiamato al cambio di selezione e su un heartbeat lento
// (così la staleness la ripulisce alla disconnessione). Best-effort, gated
// "viewer" lato server.
export function sendSelection(agentId: string | null): void {
  if (!useStore.getState().backendOnline) return;
  void fetch(`${BASE}/api/selection`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ id: getViewerId(), name: viewerName(), agentId }),
  }).catch(() => {
    /* best-effort: la presenza non è critica */
  });
}

// Driver lease (opzione B3): rivendica/rinnova per questa vista il ruolo di
// simulatore autorevole. Chiamato su un heartbeat; aggiorna subito lo store dal
// risultato (senza aspettare l'eco SSE). Best-effort, gated "viewer" lato server.
export async function claimDriver(): Promise<void> {
  if (!useStore.getState().backendOnline) return;
  try {
    const res = await fetch(`${BASE}/api/driver`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: getViewerId(), name: viewerName() }),
    });
    if (!res.ok) return;
    const d = (await res.json()) as { holderId: string; name: string };
    useStore.getState().setWorldDriver(d.holderId ? d : null);
  } catch {
    /* best-effort */
  }
}

// Movimento condiviso (opzione B3): il driver spinge le posizioni live degli agenti
// alle altre viste, che le adottano read-only e interpolano. Best-effort e lossy come
// i cursori; il server accetta la POST solo dal titolare del lease (altrimenti 204).
export function sendWorldSim(
  agents: { id: string; x: number; z: number; tx: number | null; tz: number | null; energy?: number; hunger?: number }[],
): void {
  if (!useStore.getState().backendOnline) return;
  void fetch(`${BASE}/api/worldsim`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ id: getViewerId(), agents }),
  }).catch(() => {
    /* best-effort: il movimento condiviso non è critico */
  });
}

/** Read the current driver holder at connect (so a fresh view knows immediately). */
export async function fetchDriver(): Promise<{ holderId: string; name: string } | null> {
  try {
    const res = await fetch(`${BASE}/api/driver`);
    if (!res.ok) return null;
    return (await res.json()) as { holderId: string; name: string };
  } catch {
    return null;
  }
}

export interface RepoTreeResponse {
  repo: string;
  branch: string;
  entries: { path: string; type: "blob" | "tree" }[];
  truncated: boolean;
  connected: boolean;
}

/** L'albero dei file del repo di lavoro per la sidebar. `null` se irraggiungibile. */
export async function fetchRepoTree(): Promise<RepoTreeResponse | null> {
  try {
    const res = await fetch(`${BASE}/api/repo/tree`);
    if (!res.ok) return null;
    return (await res.json()) as RepoTreeResponse;
  } catch {
    return null;
  }
}

let source: EventSource | null = null;

/** Subscribe to the runtime's event stream; returns an unsubscribe function. */
export function connectBackend(): () => void {
  // La vista si presenta al connect: id stabile + nome, come query param (unico
  // canale disponibile per un EventSource, che è sempre una GET).
  const q = new URLSearchParams({ v: getViewerId(), n: viewerName() });
  source = new EventSource(`${BASE}/api/events?${q.toString()}`);
  source.onopen = () => {
    useStore.getState().setBackendOnline(true);
    void refreshRuntimeStatus();
    // Reconcile sim state with the server: it's the source of truth, so a reload
    // or reconnect doesn't leave the client thinking the sim is off while the
    // server keeps running it (or vice-versa).
    void fetchSimStatus().then((st) => {
      if (!st) return;
      useStore.getState().setSimMode(st.enabled);
      useStore.getState().setSimLabel(st.label);
    });
    // Hydrate the workspace chat from the server (the durable source of truth).
    void fetchChat().then((msgs) => useStore.getState().setChatMessages(msgs));
    // Learn our role so the UI can gate actions the role can't perform, and adopt
    // the logged-in account's name as our workspace identity (so concurrent users
    // show their real name in presence/cursors/chat, not "Ospite"). Non sovrascrive
    // un nome scelto a mano: se l'utente ha già digitato un nome in chat, quello vince.
    void fetchWhoami().then((w) => {
      const st = useStore.getState();
      st.setViewer(w.role, w.enforced);
      if (w.name) {
        st.setAccountName(w.name);
        // Ripresenta la presence col nome vero appena appreso (la connessione SSE si
        // era già annunciata come "Ospite" col query param, prima di sapere chi siamo).
        if (!st.chatName.trim()) void announcePresence(w.name);
      }
    });
    // Learn who currently drives the shared world (opzione B3).
    void fetchDriver().then((d) => useStore.getState().setWorldDriver(d && d.holderId ? d : null));
  };
  source.onerror = () => useStore.getState().setBackendOnline(false);
  source.onmessage = (ev) => {
    try {
      useStore.getState().applyRemote(JSON.parse(ev.data) as RemoteUpdate);
    } catch {
      /* ignore keep-alive comments and malformed payloads */
    }
  };
  return () => {
    source?.close();
    source = null;
    useStore.getState().setBackendOnline(false);
  };
}
