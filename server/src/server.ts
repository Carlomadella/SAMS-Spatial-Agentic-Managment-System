import express, { type NextFunction, type Request, type Response } from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getSettings, isReady, publicStatus, updateSettings, type SettingsPatch } from "./config";
import { log } from "./log";
import { provision } from "./provision";
import { runTask } from "./sessions";
import { runGeminiTask } from "./agent";
import { runGroqTask } from "./groq";
import { runOpenrouterTask } from "./openrouter";
import { runOpenaiTask } from "./openai";
import { addIssueLabel, createBranch, createPullRequest, getRepoTree, listIssues, readFile, removeIssueLabel, runWithRepo, writeFilesAtomic } from "./github";
import { claimIssue, getClaims, getSimLabel, releaseByAgent, releaseIssue, simEnabled, simStatus, startSim, stopSim } from "./simLoop";
import { HttpError } from "./http";
import { parseGithubEvent, parsePushWatering, verifyGithubSignature } from "./webhook";
import { emptyGarden, water } from "./garden/model";
import { getPending, clearPending } from "./pendingBuffer";
import { registerGardenRoutes } from "./garden/routes";
import { getStore, initGardenStore } from "./garden/store";
import { buildPublicSnapshot, readonlyAuthorized } from "./publicView";
import { metricsSnapshot, recordChatMessage, recordClients, recordEvent } from "./metrics";
import { clearMemory, countOwners, countUsers, createAuthSession, createUser, db, deleteAuthSession, deleteRoutine, deleteUserSessionsExcept, getSessionUser, getUserByEmail, insertChatMessage, insertRoutine, listChatMessages, listMemory, listRoutines, listUsers, loadWorldSnapshot, markRoutineRun, pruneAuthSessions, recentTasks, saveWorldAgents, setRoutineEnabled, setUserRole, taskStats, updateUserPassword } from "./db";
import { hashPassword, isValidEmail, newSessionToken, normalizeEmail, publicUser, sanitizeName, SESSION_TTL_MS, validatePassword, verifyPassword, type User } from "./auth";
import { describeSchedule, dueRoutines, sanitizeRoutine } from "./routines";
import { isFreshWrite, sanitizeWorldAgents, summarizeWorld } from "./worldState";
import { sanitizeChatInput, type ChatMessage } from "./chat";
import { distinctPeople, presenceState, sanitizeObserverIdentity, type Observer } from "./presence";
import { sanitizeCursor } from "./cursors";
import { sanitizeWorldSim } from "./worldsim";
import { sanitizeSelection } from "./selections";
import { claimDriver, isLeaseValid, releaseDriver, type DriverLease } from "./driver";
import { createRateLimiter, identityKey } from "./rateLimit";
import { actorLabel } from "./attribution";
import { bearerToken, resolveRole, roleAtLeast, type Role, type RoleTokens } from "./roles";
import { randomUUID } from "node:crypto";
import type { AssignBody, WireEvent } from "./types";

const app = express();

/** I token dei tre tier dalle impostazioni correnti (owner/editor/viewer). */
function roleTokens(): RoleTokens {
  const s = getSettings();
  return { owner: s.runtimeToken, editor: s.editorToken, viewer: s.readonlyToken };
}

/**
 * Ruolo risolto per la richiesta corrente. Un **token di sessione utente valido** (auth
 * reale) vince e porta il ruolo dell'account; altrimenti si ricade sui token statici da
 * env (owner se nessuno è configurato → dev aperto). Così una persona loggata sul sito
 * governa anche la workspace col proprio ruolo, senza doppioni di configurazione.
 */
function roleOf(req: Request): Role {
  const provided = bearerToken(req.headers.authorization);
  if (provided) {
    const user = getSessionUser(db(), provided);
    if (user) return user.role;
  }
  return resolveRole(roleTokens(), provided);
}

/**
 * Guardia per ruolo (Roadmap 4, frontiera #2). Con nessun token configurato ogni
 * richiesta è "owner" → comportamento identico a prima. Con i token impostati:
 * `min="owner"` protegge config/segreti, `min="editor"` protegge l'avvio di lavoro.
 * 401 se manca del tutto il token, 403 se il ruolo è insufficiente.
 */
function requireRole(min: Role): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const provided = bearerToken(req.headers.authorization);
    const role = roleOf(req);
    if (roleAtLeast(role, min)) { next(); return; }
    log.warn("Richiesta non autorizzata", { path: req.path, ip: req.ip, role, need: min });
    if (!provided) {
      res.status(401).json({ error: "Token mancante o non valido" });
    } else {
      res.status(403).json({ error: `Ruolo insufficiente (serve ${min}, hai ${role})`, role, need: min });
    }
  };
}

// Explicit, permissive CORS for the local UI (covers SSE + preflight).
app.use((req: Request, res: Response, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
// Capture the raw body so the GitHub webhook can verify its HMAC signature
// (which is computed over the exact bytes, not the re-serialised JSON).
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
    },
  }),
);

/** Connected SSE clients (the SAMS browser UIs), each with its declared identity. */
const clients = new Map<Response, Observer>();
const HEARTBEAT_MS = 25000;

/** Write one already-serialized SSE line to every live client, dropping dead ones. */
function writeToClients(line: string): void {
  for (const res of clients.keys()) {
    if (res.writableEnded || res.destroyed) {
      clients.delete(res);
      continue;
    }
    try {
      res.write(line);
    } catch {
      clients.delete(res); // socket died between checks — drop it
    }
  }
}

function broadcast(e: WireEvent): void {
  recordEvent(e);
  // Release the per-agent cooldown once a task reaches a terminal state.
  if (e.agentId && (e.status === "done" || e.status === "review" || e.status === "idle" || e.status === "blocked")) {
    lastAssign.delete(e.agentId);
  }
  writeToClients(`data: ${JSON.stringify(e)}\n\n`);
}

/**
 * Presence (Roadmap 4, frontiera #2): tell every connected view how many views
 * are watching right now AND who they are (distinct names). Fired on connect/
 * disconnect and on a live rename. Deliberately NOT routed through `broadcast`/
 * `recordEvent` — it carries no agent state and must not inflate the runtime's
 * event metrics. `presence` stays a bare count for backward-compatible clients;
 * `people` is the new named list.
 */
function broadcastPresence(): void {
  recordClients(clients.size); // track the peak for observability
  const { views, people } = presenceState([...clients.values()]);
  writeToClients(
    `data: ${JSON.stringify({ agentId: "presence", agentName: "presence", presence: views, people })}\n\n`,
  );
}

/**
 * Presence realtime / agenti live (Roadmap 4, frontiera #2): after a view saves a
 * new authoritative world snapshot, push it to every connected view so they adopt
 * it immediately (instead of waiting ~20s for their own pull). Like presence, it
 * carries no runtime event — kept out of `broadcast`/`recordEvent` so it doesn't
 * inflate the event metrics. The writer adopting its own echo is a no-op client-side.
 */
function broadcastWorld(snapshot: { agents: unknown[]; version: number; updatedAt: number }): void {
  writeToClients(
    `data: ${JSON.stringify({ agentId: "world", agentName: "world", world: snapshot })}\n\n`,
  );
}

// Driver lease (opzione B3): quale vista è il simulatore autorevole. Vive in
// memoria (effimero); un `holderId` vuoto significa "nessun driver".
let driverLease: DriverLease | null = null;

function currentDriver(now: number): { holderId: string; name: string } {
  return isLeaseValid(driverLease, now)
    ? { holderId: driverLease!.holderId, name: driverLease!.name }
    : { holderId: "", name: "" };
}

function broadcastDriver(): void {
  const d = currentDriver(Date.now());
  writeToClients(`data: ${JSON.stringify({ agentId: "driver", agentName: "driver", driver: d })}\n\n`);
}

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true, ...publicStatus() });
});

/** Sanitized snapshot for the Settings UI (never returns the secret values). */
app.get("/api/status", (_req: Request, res: Response) => {
  res.json(publicStatus());
});

/**
 * Ruolo del chiamante (Roadmap 4, frontiera #2), così la UI può nascondere/
 * disabilitare le azioni che il ruolo non può compiere. `enforced` dice se i
 * token sono configurati (altrimenti è dev aperto e tutti sono "owner").
 */
app.get("/api/whoami", (req: Request, res: Response) => {
  const s = getSettings();
  const provided = bearerToken(req.headers.authorization);
  const hasSession = provided ? Boolean(getSessionUser(db(), provided)) : false;
  const enforced = Boolean(s.runtimeToken || s.editorToken || s.readonlyToken) || hasSession;
  res.json({ role: roleOf(req), enforced });
});

// --- Auth reale: account utente (Roadmap 4, frontiera #3) ------------------
// Sessione via **bearer token opaco** (Authorization: Bearer …), non cookie — così
// dev (porte diverse) e prod (stessa origine) si comportano identici. Il primo
// utente registrato è owner; gli altri partono viewer. Endpoint pubblici (niente
// requireRole): sono proprio il modo per ottenere un'identità.
const authLimiter = createRateLimiter(12, 5 * 60_000); // 12 tentativi / 5 min per IP
// Hash "civetta": mantiene la verifica a tempo (quasi) costante anche quando l'utente
// non esiste, così un attaccante non distingue "email assente" da "password errata".
const DUMMY_PASS_HASH = hashPassword("__sams_dummy_password__");

app.post("/api/auth/register", (req: Request, res: Response) => {
  if (!authLimiter.hit(identityKey("", req.ip))) { res.status(429).json({ error: "Troppi tentativi, riprova tra qualche minuto" }); return; }
  const body = (req.body ?? {}) as { email?: unknown; password?: unknown; name?: unknown };
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) { res.status(400).json({ error: "Email non valida" }); return; }
  const pw = validatePassword(body.password);
  if (!pw.ok) { res.status(400).json({ error: pw.error }); return; }
  const database = db();
  if (getUserByEmail(database, email)) { res.status(409).json({ error: "Esiste già un account con questa email" }); return; }
  const role: Role = countUsers(database) === 0 ? "owner" : "viewer";
  const user: User = {
    id: randomUUID(),
    email,
    name: sanitizeName(body.name, email),
    passHash: hashPassword(body.password as string),
    role,
    createdAt: Date.now(),
  };
  createUser(database, user);
  const token = newSessionToken();
  createAuthSession(database, token, user.id, Date.now() + SESSION_TTL_MS);
  log.info("Nuovo account registrato", { email, role });
  res.status(201).json({ token, user: publicUser(user) });
});

app.post("/api/auth/login", (req: Request, res: Response) => {
  if (!authLimiter.hit(identityKey("", req.ip))) { res.status(429).json({ error: "Troppi tentativi, riprova tra qualche minuto" }); return; }
  const body = (req.body ?? {}) as { email?: unknown; password?: unknown };
  const email = normalizeEmail(body.email);
  const database = db();
  const user = getUserByEmail(database, email);
  const password = typeof body.password === "string" ? body.password : "";
  // Verifica sempre un hash (quello dell'utente o il civetta) per non trapelare via timing.
  const ok = verifyPassword(password, user ? user.passHash : DUMMY_PASS_HASH);
  if (!user || !ok) { res.status(401).json({ error: "Email o password non corretti" }); return; }
  const token = newSessionToken();
  createAuthSession(database, token, user.id, Date.now() + SESSION_TTL_MS);
  res.json({ token, user: publicUser(user) });
});

app.post("/api/auth/logout", (req: Request, res: Response) => {
  const token = bearerToken(req.headers.authorization);
  if (token) deleteAuthSession(db(), token);
  res.status(204).end();
});

app.get("/api/auth/me", (req: Request, res: Response) => {
  const user = getSessionUser(db(), bearerToken(req.headers.authorization));
  if (!user) { res.status(401).json({ error: "Non autenticato" }); return; }
  res.json({ user: publicUser(user) });
});

// Gestione utenti (solo owner): elenca gli account e cambia i ruoli. Serve a rendere
// utilizzabili i ruoli in un team — senza, dopo il primo utente restano tutti viewer.
app.get("/api/auth/users", requireRole("owner"), (_req: Request, res: Response) => {
  res.json({ users: listUsers(db()) });
});

// Cambio password del proprio account (autenticato): verifica la vecchia, imposta la nuova
// e slogga gli altri dispositivi (le altre sessioni). Nessuna email → solo cambio, non reset.
app.post("/api/auth/password", (req: Request, res: Response) => {
  const token = bearerToken(req.headers.authorization);
  const user = getSessionUser(db(), token);
  if (!user) { res.status(401).json({ error: "Non autenticato" }); return; }
  const body = (req.body ?? {}) as { oldPassword?: unknown; newPassword?: unknown };
  if (!verifyPassword(typeof body.oldPassword === "string" ? body.oldPassword : "", user.passHash)) {
    res.status(401).json({ error: "Password attuale non corretta" });
    return;
  }
  const pw = validatePassword(body.newPassword);
  if (!pw.ok) { res.status(400).json({ error: pw.error }); return; }
  const database = db();
  updateUserPassword(database, user.id, hashPassword(body.newPassword as string));
  deleteUserSessionsExcept(database, user.id, token);
  log.info("Password cambiata", { email: user.email });
  res.status(204).end();
});

app.post("/api/auth/users/role", requireRole("owner"), (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { email?: unknown; role?: unknown };
  const email = normalizeEmail(body.email);
  const role = body.role;
  if (role !== "owner" && role !== "editor" && role !== "viewer") { res.status(400).json({ error: "Ruolo non valido" }); return; }
  const database = db();
  const target = getUserByEmail(database, email);
  if (!target) { res.status(404).json({ error: "Utente non trovato" }); return; }
  // Non lasciare mai il workspace senza owner: l'ultimo owner non può declassarsi.
  if (target.role === "owner" && role !== "owner" && countOwners(database) <= 1) {
    res.status(409).json({ error: "Non puoi declassare l'ultimo owner" });
    return;
  }
  setUserRole(database, email, role);
  log.info("Ruolo utente aggiornato", { email, role });
  res.json({ user: { email: target.email, name: target.name, role } });
});

/** Runtime metrics: since-boot counters + cumulative (durable) task stats. */
app.get("/api/metrics", (_req: Request, res: Response) => {
  let lifetime = { total: 0, completed: 0, tokens: 0 };
  try {
    lifetime = taskStats(db());
  } catch {
    /* DB unavailable — report since-boot metrics only */
  }
  res.json({ ...metricsSnapshot({ clients: clients.size }), lifetime });
});

/** Recent finished tasks from the durable log (newest first). */
app.get("/api/history", (_req: Request, res: Response) => {
  res.json(recentTasks(db(), 20));
});

/**
 * Read-only public snapshot of the world (runtime + metrics + garden), for a
 * shareable dashboard. No mutating actions. Guarded by SAMS_READONLY_TOKEN when
 * set (?token=…); open otherwise.
 */
app.get("/api/public", async (req: Request, res: Response) => {
  const provided = typeof req.query.token === "string" ? req.query.token : undefined;
  if (!readonlyAuthorized(getSettings().readonlyToken, provided)) {
    res.status(401).json({ error: "Token di sola lettura mancante o non valido" });
    return;
  }
  let lifetime = { total: 0, completed: 0, tokens: 0 };
  try {
    lifetime = taskStats(db());
  } catch {
    /* DB unavailable — since-boot metrics only */
  }
  let board: Awaited<ReturnType<ReturnType<typeof getStore>["top"]>> = [];
  try {
    board = await getStore().top(10);
  } catch {
    /* garden store unavailable — omit leaderboard */
  }
  let world = { agents: 0, working: 0, idle: 0 };
  try {
    world = summarizeWorld(loadWorldSnapshot(db()));
  } catch {
    /* world snapshot unavailable — omit */
  }
  res.json(
    buildPublicSnapshot({
      status: publicStatus(),
      metrics: { ...metricsSnapshot({ clients: clients.size }), lifetime },
      board,
      world,
      viewers: clients.size,
    }),
  );
});

/** Current content of a repo file (the "before" side of a staged diff). */
app.get("/api/file", async (req: Request, res: Response) => {
  const filePath = String(req.query.path ?? "");
  const ref = String(req.query.ref ?? getSettings().baseBranch);
  if (!filePath) {
    res.status(400).json({ error: "path richiesto" });
    return;
  }
  try {
    res.json({ content: await readFile(filePath, ref), exists: true });
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) {
      res.json({ content: "", exists: false }); // new file → no "before"
      return;
    }
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/** L'albero dei file del repo di lavoro, per la sidebar "Esplora risorse". Senza
 *  token GitHub risponde `connected:false` (la UI mostra un invito a collegarlo). */
app.get("/api/repo/tree", async (_req: Request, res: Response) => {
  const s = getSettings();
  if (!s.githubToken) {
    res.json({ repo: s.githubRepo, branch: s.baseBranch, entries: [], truncated: false, connected: false });
    return;
  }
  try {
    const { entries, truncated, branch } = await getRepoTree(s.baseBranch);
    res.json({ repo: s.githubRepo, branch, entries, truncated, connected: true });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err), entries: [], connected: false });
  }
});

/** Save settings entered in the app (keys, repo, model…). */
app.post("/api/settings", requireRole("owner"), (req: Request, res: Response) => {
  const body = (req.body ?? {}) as SettingsPatch;
  const patch: SettingsPatch = {};
  if (body.provider === "gemini" || body.provider === "claude" || body.provider === "groq" || body.provider === "openrouter" || body.provider === "openai") patch.provider = body.provider;
  if (typeof body.groqApiKey === "string" && body.groqApiKey.trim()) patch.groqApiKey = body.groqApiKey.trim();
  if (typeof body.openrouterApiKey === "string" && body.openrouterApiKey.trim()) patch.openrouterApiKey = body.openrouterApiKey.trim();
  if (typeof body.openaiApiKey === "string" && body.openaiApiKey.trim()) patch.openaiApiKey = body.openaiApiKey.trim();
  if (typeof body.geminiApiKey === "string" && body.geminiApiKey.trim()) patch.geminiApiKey = body.geminiApiKey.trim();
  if (typeof body.anthropicApiKey === "string" && body.anthropicApiKey.trim()) patch.anthropicApiKey = body.anthropicApiKey.trim();
  if (typeof body.githubToken === "string" && body.githubToken.trim()) patch.githubToken = body.githubToken.trim();
  if (typeof body.githubRepo === "string" && body.githubRepo.trim()) patch.githubRepo = body.githubRepo.trim();
  if (typeof body.baseBranch === "string" && body.baseBranch.trim()) patch.baseBranch = body.baseBranch.trim();
  if (typeof body.model === "string" && body.model.trim()) patch.model = body.model.trim();
  if (typeof body.openPRs === "boolean") patch.openPRs = body.openPRs;
  if (typeof body.requireApproval === "boolean") patch.requireApproval = body.requireApproval;
  if (typeof body.notionToken === "string" && body.notionToken.trim()) patch.notionToken = body.notionToken.trim();
  if (typeof body.notionPageId === "string") patch.notionPageId = body.notionPageId.trim();
  updateSettings(patch);
  res.json(publicStatus());
});

/** Create (or re-create) the managed Agent + Environment (Claude provider only). */
app.post("/api/provision", requireRole("owner"), async (_req: Request, res: Response) => {
  if (getSettings().provider !== "claude") {
    res.json({ ...publicStatus(), note: "Gemini non richiede provisioning" });
    return;
  }
  try {
    const ids = await provision();
    res.json({ ...publicStatus(), ...ids });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/events", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write(": connected\n\n");
  // Identità dichiarata dalla vista al connect (canale bidirezionale, primo pezzo
  // concreto della frontiera #1): `v` = id stabile persistito, `n` = nome.
  const observer = sanitizeObserverIdentity(req.query.v, req.query.n);
  clients.set(res, observer);
  log.info("Vista connessa", { views: clients.size, name: observer.name });
  broadcastPresence(); // tell everyone (incl. the new view) the updated count

  // Single cleanup path: a dead socket does NOT make res.write throw in Node, so
  // we must not rely on a throw — react to close/error and guard every write.
  let closed = false;
  function cleanup() {
    if (closed) return; // close + error can both fire — count the drop once
    closed = true;
    clearInterval(heartbeat);
    clients.delete(res);
    log.info("Vista disconnessa", { views: clients.size, name: observer.name });
    broadcastPresence();
    // Se il driver se ne va, rilascia subito il lease (handover immediato, senza
    // aspettare la scadenza) e avvisa le altre viste.
    if (driverLease && driverLease.holderId === observer.id) {
      driverLease = releaseDriver(driverLease, observer.id);
      broadcastDriver();
    }
  }
  const heartbeat = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      cleanup();
      return;
    }
    try {
      res.write(": ping\n\n");
    } catch {
      cleanup();
    }
  }, HEARTBEAT_MS);
  res.on("error", cleanup);
  req.on("close", cleanup);
});

// Per-agent cooldown: prevent hammering an agent with rapid task submissions.
const ASSIGN_COOLDOWN_MS = 20_000; // 20 s between task starts per agent
const lastAssign = new Map<string, number>();

// Quota per-utente (Roadmap 4): con un workspace condiviso il cooldown per-agente
// non basta — un utente potrebbe saturare il runtime spargendo task su molti
// agenti. Questo limite è per *utente* (token, o IP in mancanza), non per agente.
const assignQuota = createRateLimiter(15, 60_000); // max 15 assegnazioni / minuto

app.post("/api/assign", requireRole("editor"), (req: Request, res: Response) => {
  const body = req.body as AssignBody;
  if (!body?.agentId || !body?.title) {
    res.status(400).json({ error: "agentId and title are required" });
    return;
  }
  if (!isReady()) {
    res.status(503).json({ error: "Runtime non pronto — apri le Impostazioni, salva le chiavi e premi 'Provisiona agenti'." });
    return;
  }

  const now = Date.now();
  const prev = lastAssign.get(body.agentId) ?? 0;
  const wait = Math.ceil((ASSIGN_COOLDOWN_MS - (now - prev)) / 1000);
  if (wait > 0) {
    res.status(429).json({ error: `Agente occupato — riprova tra ${wait}s`, retryAfterSec: wait });
    return;
  }

  // Quota per-utente: verificata *dopo* il cooldown per-agente (così un utente non
  // "spende" la quota se comunque l'agente è occupato) e prima di avviare il lavoro.
  const userKey = identityKey(bearerToken(req.headers.authorization), req.ip);
  if (!assignQuota.hit(userKey, now)) {
    const qWait = Math.ceil(assignQuota.retryAfterMs(userKey, now) / 1000);
    res.status(429).json({ error: `Troppe assegnazioni — riprova tra ${qWait}s`, retryAfterSec: qWait });
    return;
  }
  lastAssign.set(body.agentId, now);

  res.json({ ok: true });

  // Attribuzione: chi ha avviato il lavoro (nome della vista + ruolo).
  log.info("Task assegnato", { by: actorLabel(roleOf(req), body.actor), agent: body.agentName || body.agentId, title: body.title });

  const { provider } = getSettings();
  const runner =
    provider === "gemini" ? runGeminiTask
    : provider === "groq" ? runGroqTask
    : provider === "openrouter" ? runOpenrouterTask
    : provider === "openai" ? runOpenaiTask
    : runTask;
  // A meta-agente task carries a repo override (owner/repo). Run the whole task
  // inside that repo context so every GitHub call targets it instead of the
  // global repository. Invalid overrides are ignored (fall back to global).
  const repo = typeof body.repo === "string" && /^[\w.-]+\/[\w.-]+$/.test(body.repo) ? body.repo : null;
  const start = () => runner(body, broadcast);
  const work = repo ? runWithRepo(repo, start) : start();
  work.catch((err: unknown) => {
    lastAssign.delete(body.agentId); // release on error so the user can retry
    broadcast({
      agentId: body.agentId,
      agentName: body.agentName || body.agentId,
      status: "blocked",
      level: "ERROR",
      message: `Errore: ${err instanceof Error ? err.message : String(err)}`,
    });
  });
});

/** Agent memory — read all memories for an agent. */
app.get("/api/memory/:agentId", (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;
  res.json(listMemory(db(), agentId));
});

/** Agent memory — clear all memories for an agent. */
app.delete("/api/memory/:agentId", requireRole("editor"), (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;
  clearMemory(db(), agentId);
  res.json({ ok: true });
});

/** Approve staged files: create branch, commit each file, optionally open a PR. */
app.post("/api/approve/:agentId", requireRole("editor"), async (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;
  const work = getPending(agentId);
  if (!work) {
    res.status(404).json({ error: "Nessun file in attesa per questo agente" });
    return;
  }
  clearPending(agentId);
  res.json({ ok: true }); // respond immediately; commit happens in background

  const actor = (req.body as { actor?: string } | undefined)?.actor;
  log.info("Modifiche approvate", { by: actorLabel(roleOf(req), actor), agent: work.agentName, title: work.title });

  const s = getSettings();
  const agentName = work.agentName;
  try {
    await createBranch(work.branch, s.baseBranch);
    broadcast({ agentId, agentName, level: "INFO", message: `Branch ${work.branch} creato` });
    // Atomic commit: all staged files in a single tree+commit (no partial-commit risk)
    const commitMsg = work.files.length === 1
      ? work.files[0].message
      : `SAMS(${agentName}): ${work.title} — ${work.files.length} file`;
    await writeFilesAtomic(work.files.map((f) => ({ path: f.path, content: f.content })), work.branch, commitMsg);
    broadcast({ agentId, agentName, level: "SUCCESS", message: `${work.files.length} file committati su ${work.branch}` });
    if (s.openPRs) {
      const pr = await createPullRequest({
        branch: work.branch,
        title: work.title,
        body: `Automated by SAMS agent **${agentName}**.\n\n**Task:** ${work.title}\n\n_Branch \`${work.branch}\` → \`${s.baseBranch}\`._`,
      });
      broadcast({ agentId, agentName, level: "SUCCESS", message: `PR #${pr.number}: ${pr.html_url}` });
    }
    broadcast({ agentId, agentName, status: "review", progress: 100, level: "SUCCESS", message: "Lavoro completato" });
  } catch (err) {
    broadcast({ agentId, agentName, status: "blocked", level: "ERROR", message: `Commit fallito: ${(err as Error).message}` });
  }
});

/** Reject staged files: discard buffer, agent returns to idle. */
app.post("/api/reject/:agentId", requireRole("editor"), (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;
  const actor = (req.body as { actor?: string } | undefined)?.actor;
  log.info("Modifiche rifiutate", { by: actorLabel(roleOf(req), actor), agent: agentId });
  clearPending(agentId);
  broadcast({ agentId, agentName: "runtime", status: "idle", level: "WARN", message: "Diff rifiutato — nessuna modifica applicata" });
  res.json({ ok: true });
});

// --- Live Simulation mode ------------------------------------------------

app.get("/api/sim/status", (_req: Request, res: Response) => {
  res.json(simStatus());
});

app.post("/api/sim/start", requireRole("editor"), (req: Request, res: Response) => {
  const label =
    typeof req.body?.label === "string" && req.body.label.trim()
      ? req.body.label.trim()
      : "sams";
  startSim(label);
  broadcast({ agentId: "sim", agentName: "sim", level: "INFO", message: `🟢 Live Sim avviata · label: ${label}` });
  res.json(simStatus());
});

app.post("/api/sim/stop", requireRole("editor"), (_req: Request, res: Response) => {
  stopSim();
  broadcast({ agentId: "sim", agentName: "sim", level: "WARN", message: "🔴 Live Sim fermata" });
  res.json(simStatus());
});

app.get("/api/sim/issues", async (_req: Request, res: Response) => {
  if (!isReady()) {
    res.status(503).json({ error: "Runtime non pronto" });
    return;
  }
  try {
    const issues = await listIssues(getSimLabel());
    const claims = getClaims();
    res.json(issues.map((i) => ({ ...i, claimedBy: claims.get(i.number)?.agentId })));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/sim/claim/:issueNumber", (req: Request, res: Response) => {
  const issueNumber = Number(req.params.issueNumber);
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    res.status(400).json({ error: "issueNumber non valido" });
    return;
  }
  const agentId = typeof req.body?.agentId === "string" ? req.body.agentId.trim() : "";
  if (!agentId) {
    res.status(400).json({ error: "agentId richiesto" });
    return;
  }
  if (!simEnabled()) {
    res.status(409).json({ error: "Sim non attiva" });
    return;
  }
  if (!claimIssue(issueNumber, agentId)) {
    res.status(409).json({ error: "Issue già reclamata" });
    return;
  }
  // Best-effort: add in-progress label in background (never blocks the response)
  void addIssueLabel(issueNumber, "sams:in-progress").catch(() => {});
  res.json({ ok: true, issueNumber, agentId });
});

app.post("/api/sim/release/:issueNumber", (req: Request, res: Response) => {
  const issueNumber = Number(req.params.issueNumber);
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    res.status(400).json({ error: "issueNumber non valido" });
    return;
  }
  // Optional agentId makes the release owner-aware (won't steal another agent's claim).
  const agentId = typeof req.body?.agentId === "string" ? req.body.agentId.trim() : undefined;
  releaseIssue(issueNumber, agentId || undefined);
  void removeIssueLabel(issueNumber, "sams:in-progress").catch(() => {});
  res.json({ ok: true });
});

// Release whatever issue an agent currently holds — robust to the client having
// lost track of the issue number (e.g. the issue was closed on GitHub and dropped
// out of the polled list). This is the primary completion-driven release path.
app.post("/api/sim/release-by-agent/:agentId", (req: Request, res: Response) => {
  const agentId = (req.params.agentId as string)?.trim();
  if (!agentId) {
    res.status(400).json({ error: "agentId richiesto" });
    return;
  }
  const issueNumber = releaseByAgent(agentId);
  if (issueNumber !== undefined) {
    void removeIssueLabel(issueNumber, "sams:in-progress").catch(() => {});
  }
  res.json({ ok: true, issueNumber });
});

// --- Stato autorevole del mondo (Roadmap 4, primo slice) -----------------
// A durable, server-side copy of the world (agents + tasks). The client pushes
// a snapshot periodically (POST) and anyone can read it (GET) — the first step
// toward an authoritative server state, without yet reconciling back to the
// client. Survives runtime restarts.

app.get("/api/world", (_req: Request, res: Response) => {
  try {
    res.json(loadWorldSnapshot(db()));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/world", requireRole("editor"), (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { agents?: unknown; baseVersion?: unknown };
  const agents = sanitizeWorldAgents(body.agents);
  const baseVersion = typeof body.baseVersion === "number" ? body.baseVersion : undefined;
  try {
    // Concorrenza ottimistica (compare-and-swap): con più scrittori, rifiuta una
    // scrittura la cui `baseVersion` non è più quella corrente e restituisce lo
    // snapshot autorevole, così il client concilia (adotta la versione remota) e
    // ripresenta. Load→check→save è atomico qui: nessun `await` nel mezzo.
    const current = loadWorldSnapshot(db());
    if (!isFreshWrite(current.version, baseVersion)) {
      res.status(409).json({
        ok: false,
        conflict: true,
        version: current.version,
        updatedAt: current.updatedAt,
        agents: current.agents,
      });
      return;
    }
    // Merge per-riga (non sostituzione del blob): create/update + tombstone per
    // gli agenti spariti da questo push CAS-fresco. Lo snapshot restituito porta i
    // tombstone, così le altre viste rimuovono in sicurezza gli agenti cancellati.
    const snapshot = saveWorldAgents(db(), agents);
    // Propaga live lo snapshot autorevole a tutte le viste (presence realtime) —
    // **solo se qualcosa è cambiato**: un push no-op (vista che ha appena adottato e
    // rispinge il roster identico) non genera echo → niente ping-pong tra le viste.
    if (snapshot.changed) {
      broadcastWorld({ agents: snapshot.agents, version: snapshot.version, updatedAt: snapshot.updatedAt });
    }
    res.json({ ok: true, version: snapshot.version, updatedAt: snapshot.updatedAt, ...summarizeWorld(snapshot) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- Chat di workspace (Roadmap 4, frontiera #2) -------------------------
// A human-to-human channel next to the scene, separate from the runtime event
// log. Messages live in SQLite and are broadcast over SSE to every connected
// view, so people watching the same office can talk live.

app.get("/api/chat", (_req: Request, res: Response) => {
  try {
    res.json(listChatMessages(db()));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Per-IP flood guard for the shared chat: at most 10 messages every 30s.
const chatLimiter = createRateLimiter(10, 30_000);

app.post("/api/chat", requireRole("editor"), (req: Request, res: Response) => {
  const input = sanitizeChatInput(req.body);
  if (!input) {
    res.status(400).json({ error: "Messaggio vuoto" });
    return;
  }
  const key = req.ip ?? "?";
  if (!chatLimiter.hit(key)) {
    const wait = Math.ceil(chatLimiter.retryAfterMs(key) / 1000);
    res.status(429).json({ error: `Troppi messaggi — riprova tra ${wait}s`, retryAfterSec: wait });
    return;
  }
  const msg: ChatMessage = { id: randomUUID(), author: input.author, text: input.text, ts: Date.now() };
  try {
    insertChatMessage(db(), msg);
    recordChatMessage();
    // Rimbalza a tutte le viste (fuori da recordEvent: non è un evento runtime).
    writeToClients(`data: ${JSON.stringify({ agentId: "chat", agentName: "chat", chat: msg })}\n\n`);
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- Presence: rinomina live (canale bidirezionale) ----------------------
// La vista dichiara la sua identità al connect (query param dell'EventSource);
// questo endpoint le permette di cambiare nome *senza riconnettersi* — primo
// pezzo concreto del canale client→server (frontiera #1). Aggiorna il nome di
// tutte le connessioni con lo stesso id (più schede) e ri-annuncia la presence.
const presenceLimiter = createRateLimiter(20, 30_000);

app.post("/api/presence", requireRole("editor"), (req: Request, res: Response) => {
  const { id, name } = sanitizeObserverIdentity((req.body as { id?: unknown })?.id, (req.body as { name?: unknown })?.name);
  if (!id) {
    res.status(400).json({ error: "id osservatore mancante" });
    return;
  }
  const key = req.ip ?? "?";
  if (!presenceLimiter.hit(key)) {
    const wait = Math.ceil(presenceLimiter.retryAfterMs(key) / 1000);
    res.status(429).json({ error: `Troppe modifiche — riprova tra ${wait}s`, retryAfterSec: wait });
    return;
  }
  let changed = 0;
  for (const [res2, obs] of clients) {
    if (obs.id === id && obs.name !== name) {
      clients.set(res2, { id, name });
      changed++;
    }
  }
  if (changed > 0) broadcastPresence();
  res.json({ ok: true, changed, people: distinctPeople([...clients.values()]) });
});

// --- Cursori live (Roadmap 4, frontiera #2) ------------------------------
// Ogni vista rimbalza la posizione del suo puntatore sul pavimento; le altre lo
// disegnano in scena. Effimero (niente DB), rimbalzato sul canale SSE esistente e
// tenuto fuori da `broadcast`/`recordEvent` (non è un evento runtime → non gonfia
// le metriche). Gated "viewer": anche un osservatore read-only mostra il cursore,
// ma con i token imposti serve comunque un token valido. Il rate-limit è per-vista
// (chiave = id del cursore) così più schede sullo stesso IP non si rubano il budget;
// oltre soglia si scarta in silenzio (204) — i cursori sono lossy per natura.
const cursorLimiter = createRateLimiter(20, 1000); // ~20 update/s per vista

app.post("/api/cursor", requireRole("viewer"), (req: Request, res: Response) => {
  const c = sanitizeCursor(req.body);
  if (!c) {
    res.status(400).json({ error: "cursore non valido" });
    return;
  }
  if (!cursorLimiter.hit(c.id)) {
    res.status(204).end(); // troppo veloce → scarta senza rumore
    return;
  }
  writeToClients(
    `data: ${JSON.stringify({ agentId: "cursor", agentName: "cursor", cursor: { ...c, ts: Date.now() } })}\n\n`,
  );
  res.status(204).end();
});

// --- Presenza di selezione (Roadmap 4, frontiera #2) ---------------------
// Gemella dei cursori: ogni vista annuncia quale agente ha selezionato (o null);
// le altre lo mostrano con un'aura sull'agente. Il client rimanda la selezione
// corrente a bassa frequenza (heartbeat) così la staleness la ripulisce quando
// una vista si disconnette. Stesso stile dei cursori: effimero, fuori da
// `recordEvent`, gated "viewer", rate-limit per-vista.
const selectionLimiter = createRateLimiter(15, 5000); // ~3 update/s per vista

app.post("/api/selection", requireRole("viewer"), (req: Request, res: Response) => {
  const sel = sanitizeSelection(req.body);
  if (!sel) {
    res.status(400).json({ error: "selezione non valida" });
    return;
  }
  if (!selectionLimiter.hit(sel.id)) {
    res.status(204).end();
    return;
  }
  writeToClients(
    `data: ${JSON.stringify({ agentId: "selection", agentName: "selection", selection: { ...sel, ts: Date.now() } })}\n\n`,
  );
  res.status(204).end();
});

// --- Driver lease (Roadmap 4, opzione B3) --------------------------------
// Elegge UNA vista come simulatore autorevole (primo mattone del mondo animato
// condiviso — non sposta ancora il game loop). Le viste rinnovano il lease su un
// heartbeat; il titolare vince sempre il rinnovo, gli altri solo se è scaduto →
// handover automatico se il driver sparisce. Gated "viewer" come gli altri
// canali di presenza.
const driverLimiter = createRateLimiter(10, 5000); // heartbeat ~0.5/s, ampio margine

app.get("/api/driver", (_req: Request, res: Response) => {
  res.json(currentDriver(Date.now()));
});

app.post("/api/driver", requireRole("viewer"), (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { id?: unknown; name?: unknown };
  const { id, name } = sanitizeObserverIdentity(body.id, body.name);
  if (!id) {
    res.status(400).json({ error: "id vista mancante" });
    return;
  }
  const now = Date.now();
  if (!driverLimiter.hit(id)) {
    const d = currentDriver(now);
    res.json({ ...d, youAreDriver: d.holderId === id });
    return;
  }
  const { lease, changed } = claimDriver(driverLease, id, name, now);
  driverLease = lease;
  if (changed) broadcastDriver();
  res.json({ holderId: lease.holderId, name: lease.name, youAreDriver: lease.holderId === id });
});

// --- Movimento condiviso: snapshot cinematico (Roadmap 4, opzione B3) -----
// Il driver — e SOLO il driver — spinge le posizioni live degli agenti; le altre
// viste le adottano read-only e interpolano → tutti vedono lo stesso ufficio
// animarsi insieme. Effimero come i cursori (niente DB), broadcast SSE fuori da
// `recordEvent`. Gated "viewer", ma in più si accetta solo dal titolare corrente
// del lease: una vista non-driver che tentasse di spingere viene scartata in
// silenzio (204), così non esistono due simulatori che si contendono il movimento.
const worldSimLimiter = createRateLimiter(15, 1000); // fino a ~15 update/s dal driver

app.post("/api/worldsim", requireRole("viewer"), (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { id?: unknown; agents?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  const now = Date.now();
  // Solo il driver in carica può spingere il mondo animato (evita la doppia simulazione).
  if (!id || !isLeaseValid(driverLease, now) || driverLease!.holderId !== id) {
    res.status(204).end();
    return;
  }
  if (!worldSimLimiter.hit(id)) {
    res.status(204).end(); // oltre soglia → scarta senza rumore (il movimento è lossy)
    return;
  }
  const agents = sanitizeWorldSim(body.agents);
  writeToClients(
    `data: ${JSON.stringify({ agentId: "worldsim", agentName: "worldsim", worldsim: { agents, ts: now } })}\n\n`,
  );
  res.status(204).end();
});

// --- Routine / trigger temporali ----------------------------------------
// Scheduled recurring tasks ("ogni mattina: riepilogo PR"). Stored durably in
// SQLite; a scheduler tick fires a `wake` (source: "routine") that the UI turns
// into an assignment to a free agent — reusing the same path as webhook wakes.

app.get("/api/routines", (_req: Request, res: Response) => {
  try {
    res.json(listRoutines(db()).map((r) => ({ ...r, schedule: describeSchedule(r) })));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/routines", requireRole("editor"), (req: Request, res: Response) => {
  const input = sanitizeRoutine(req.body);
  if (!input) {
    res.status(400).json({ error: "Nome e titolo del task sono obbligatori" });
    return;
  }
  try {
    const routine = insertRoutine(db(), randomUUID(), input);
    broadcast({ agentId: "routine", agentName: "Routine", level: "INFO", message: `⏰ Routine creata: ${routine.name} (${describeSchedule(routine)})` });
    res.json({ ...routine, schedule: describeSchedule(routine) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/routines/:id/toggle", requireRole("editor"), (req: Request, res: Response) => {
  const id = req.params.id as string;
  const enabled = req.body?.enabled !== false;
  try {
    setRoutineEnabled(db(), id, enabled);
    res.json({ ok: true, id, enabled });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.delete("/api/routines/:id", requireRole("editor"), (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    deleteRoutine(db(), id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * Scheduler tick: assign each due routine by broadcasting a `wake`. We only fire
 * when the runtime is ready (otherwise the assignment would 503 on the client)
 * and when at least one UI is connected to receive it — leaving `lastRun`
 * untouched so the routine fires as soon as those conditions hold, without a
 * burst. `markRoutineRun` stamps the time so a routine runs once per due window.
 */
const ROUTINE_TICK_MS = 30_000;
function routineTick(): void {
  if (!isReady() || clients.size === 0) return;
  let due;
  try {
    due = dueRoutines(listRoutines(db()), Date.now());
  } catch {
    return; // DB unavailable — try again next tick
  }
  for (const r of due) {
    markRoutineRun(db(), r.id, Date.now());
    broadcast({
      agentId: "routine",
      agentName: "Routine",
      level: "WARN",
      message: `⏰ Routine "${r.name}" → ${r.title}`,
      wake: { title: r.title, branch: r.branch || undefined, reason: `routine: ${r.name}`, source: "routine" },
    });
  }
}

// GitHub webhook — receives push / pull_request / workflow_run events. Verifies
// the HMAC signature (if GITHUB_WEBHOOK_SECRET is set), re-broadcasts a summary
// as a SAMS WireEvent, and on a CI failure attaches a "wake" suggestion so the
// frontend can assign a contextual fix task to a free agent.
// To connect: GitHub → Repo Settings → Webhooks → http://host/api/webhook/github
// (Content-Type: application/json; set a Secret = GITHUB_WEBHOOK_SECRET).
app.post("/api/webhook/github", (req: Request, res: Response) => {
  const event = req.headers["x-github-event"] as string | undefined;
  if (!event) { res.status(400).json({ error: "x-github-event header missing" }); return; }

  const secret = getSettings().githubWebhookSecret;
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? "";
  if (!verifyGithubSignature(secret, rawBody, signature)) {
    log.warn("Webhook GitHub rifiutato: firma non valida", { event });
    res.status(401).json({ error: "firma non valida" });
    return;
  }
  res.json({ ok: true });

  // Auto-innaffiatura: un push reale fa crescere il giardino di chi ha spinto,
  // senza aspettare il refresh manuale. `latestSeen` = head commit, così il
  // polling (fetchPushActivity) non riconta gli stessi commit.
  if (event === "push") {
    const w = parsePushWatering(req.body as Record<string, unknown>);
    if (w) {
      void (async () => {
        try {
          const store = getStore();
          const prev = (await store.get(w.user)) ?? emptyGarden(w.user);
          const next = water(prev, w.waterings, w.latestSeen, new Date().toISOString().slice(0, 10));
          await store.put(next);
          broadcast({
            agentId: "github",
            agentName: "GitHub",
            level: "SUCCESS",
            message: `🌱 Giardino di ${w.user} innaffiato (+${w.waterings}) → ${next.stage}`,
          });
        } catch (err) {
          log.warn("Auto-innaffiatura fallita", { user: w.user, error: (err as Error).message });
        }
      })();
    }
  }

  const result = parseGithubEvent(event, req.body as Record<string, unknown>);
  if (!result) { log.debug("GitHub webhook ignorato", { event }); return; }

  broadcast({ agentId: "github", agentName: "GitHub", level: result.level, message: result.message });
  if (result.wake) {
    broadcast({
      agentId: "github",
      agentName: "GitHub",
      level: "WARN",
      message: `🔔 ${result.wake.reason} — suggerito un task contestuale`,
      wake: { ...result.wake, source: "webhook" },
    });
  }
});

// Commit Garden lives inside the SAMS runtime (no separate app/port).
registerGardenRoutes(app);

// In production (Docker), serve the Vite build as static files so the same
// Express process handles both the API and the SPA without a separate Nginx.
if (process.env.NODE_ENV === "production") {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const publicDir = join(__dir, "../../dist");
  app.use(express.static(publicDir));
  app.use((_req: Request, res: Response) => {
    res.sendFile(join(publicDir, "index.html"));
  });
}

// Final error handler: turn body-parse / payload-size / unexpected throws into
// consistent JSON instead of Express's default HTML error page.
app.use((err: Error & { type?: string; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Corpo della richiesta JSON non valido" });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "Payload troppo grande" });
    return;
  }
  log.error("Errore non gestito", { msg: err.message ?? String(err) });
  res.status(500).json({ error: "Errore interno del runtime" });
});

// Last-resort safety net so a stray rejection logs instead of crashing silently.
process.on("unhandledRejection", (reason) => log.error("UnhandledRejection", { reason: String(reason) }));

const { port, githubRepo } = getSettings();
app.listen(port, () => {
  log.info(`SAMS runtime avviato`, { url: `http://localhost:${port}`, repo: githubRepo, ready: isReady() });
  void initGardenStore()
    .then((k) => log.info("Garden store pronto", { backend: k }))
    .catch((err) => log.error("Garden store init fallito", { error: (err as Error).message }));
  // Start the routine scheduler (checks for due recurring tasks every 30s).
  setInterval(routineTick, ROUTINE_TICK_MS);
  // Garbage-collect expired auth sessions: once at boot, then every 6 hours.
  const pruneSessions = () => {
    try {
      const n = pruneAuthSessions(db());
      if (n > 0) log.info("Sessioni scadute rimosse", { count: n });
    } catch {
      /* DB non disponibile → riprova al prossimo giro */
    }
  };
  pruneSessions();
  setInterval(pruneSessions, 6 * 60 * 60 * 1000);
});
