import express, { type NextFunction, type Request, type Response } from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getSettings, isReady, publicStatus, updateSettings, type SettingsPatch } from "./config";
import { log } from "./log";
import { provision } from "./provision";
import { runTask } from "./sessions";
import { runGeminiTask } from "./agent";
import { runGroqTask } from "./groq";
import { addIssueLabel, createBranch, createPullRequest, listIssues, readFile, removeIssueLabel, runWithRepo, writeFilesAtomic } from "./github";
import { claimIssue, getClaims, getSimLabel, releaseByAgent, releaseIssue, simEnabled, simStatus, startSim, stopSim } from "./simLoop";
import { HttpError } from "./http";
import { parseGithubEvent, parsePushWatering, verifyGithubSignature } from "./webhook";
import { emptyGarden, water } from "./garden/model";
import { getPending, clearPending } from "./pendingBuffer";
import { registerGardenRoutes } from "./garden/routes";
import { getStore, initGardenStore } from "./garden/store";
import { buildPublicSnapshot, readonlyAuthorized } from "./publicView";
import { metricsSnapshot, recordEvent } from "./metrics";
import { clearMemory, db, deleteRoutine, insertChatMessage, insertRoutine, listChatMessages, listMemory, listRoutines, loadWorldSnapshot, markRoutineRun, recentTasks, saveWorldSnapshot, setRoutineEnabled, taskStats } from "./db";
import { describeSchedule, dueRoutines, sanitizeRoutine } from "./routines";
import { sanitizeWorldAgents, summarizeWorld } from "./worldState";
import { sanitizeChatInput, type ChatMessage } from "./chat";
import { randomUUID } from "node:crypto";
import type { AssignBody, WireEvent } from "./types";

const app = express();

/** Optional Bearer-token guard. If SAMS_TOKEN is set, mutating routes require the header. */
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = getSettings().runtimeToken;
  if (!token) { next(); return; }
  const auth = req.headers.authorization ?? "";
  if (auth !== `Bearer ${token}`) {
    log.warn("Richiesta non autorizzata", { path: req.path, ip: req.ip });
    res.status(401).json({ error: "Token mancante o non valido" });
    return;
  }
  next();
}

// Explicit, permissive CORS for the local UI (covers SSE + preflight).
app.use((req: Request, res: Response, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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

/** Connected SSE clients (the SAMS browser UIs). */
const clients = new Set<Response>();
const HEARTBEAT_MS = 25000;

/** Write one already-serialized SSE line to every live client, dropping dead ones. */
function writeToClients(line: string): void {
  for (const res of clients) {
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
 * are watching right now. Fired on connect/disconnect. Deliberately NOT routed
 * through `broadcast`/`recordEvent` — it carries no agent state and must not
 * inflate the runtime's event metrics.
 */
function broadcastPresence(): void {
  writeToClients(`data: ${JSON.stringify({ agentId: "presence", agentName: "presence", presence: clients.size })}\n\n`);
}

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true, ...publicStatus() });
});

/** Sanitized snapshot for the Settings UI (never returns the secret values). */
app.get("/api/status", (_req: Request, res: Response) => {
  res.json(publicStatus());
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

/** Save settings entered in the app (keys, repo, model…). */
app.post("/api/settings", requireAuth, (req: Request, res: Response) => {
  const body = (req.body ?? {}) as SettingsPatch;
  const patch: SettingsPatch = {};
  if (body.provider === "gemini" || body.provider === "claude" || body.provider === "groq") patch.provider = body.provider;
  if (typeof body.groqApiKey === "string" && body.groqApiKey.trim()) patch.groqApiKey = body.groqApiKey.trim();
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
app.post("/api/provision", async (_req: Request, res: Response) => {
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
  clients.add(res);
  broadcastPresence(); // tell everyone (incl. the new view) the updated count

  // Single cleanup path: a dead socket does NOT make res.write throw in Node, so
  // we must not rely on a throw — react to close/error and guard every write.
  let closed = false;
  function cleanup() {
    if (closed) return; // close + error can both fire — count the drop once
    closed = true;
    clearInterval(heartbeat);
    clients.delete(res);
    broadcastPresence();
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

app.post("/api/assign", requireAuth, (req: Request, res: Response) => {
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
  lastAssign.set(body.agentId, now);

  res.json({ ok: true });

  const { provider } = getSettings();
  const runner = provider === "gemini" ? runGeminiTask : provider === "groq" ? runGroqTask : runTask;
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
app.delete("/api/memory/:agentId", requireAuth, (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;
  clearMemory(db(), agentId);
  res.json({ ok: true });
});

/** Approve staged files: create branch, commit each file, optionally open a PR. */
app.post("/api/approve/:agentId", requireAuth, async (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;
  const work = getPending(agentId);
  if (!work) {
    res.status(404).json({ error: "Nessun file in attesa per questo agente" });
    return;
  }
  clearPending(agentId);
  res.json({ ok: true }); // respond immediately; commit happens in background

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
app.post("/api/reject/:agentId", requireAuth, (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;
  clearPending(agentId);
  broadcast({ agentId, agentName: "runtime", status: "idle", level: "WARN", message: "Diff rifiutato — nessuna modifica applicata" });
  res.json({ ok: true });
});

// --- Live Simulation mode ------------------------------------------------

app.get("/api/sim/status", (_req: Request, res: Response) => {
  res.json(simStatus());
});

app.post("/api/sim/start", requireAuth, (req: Request, res: Response) => {
  const label =
    typeof req.body?.label === "string" && req.body.label.trim()
      ? req.body.label.trim()
      : "sams";
  startSim(label);
  broadcast({ agentId: "sim", agentName: "sim", level: "INFO", message: `🟢 Live Sim avviata · label: ${label}` });
  res.json(simStatus());
});

app.post("/api/sim/stop", requireAuth, (_req: Request, res: Response) => {
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

app.post("/api/world", requireAuth, (req: Request, res: Response) => {
  const agents = sanitizeWorldAgents((req.body as { agents?: unknown })?.agents);
  try {
    const snapshot = saveWorldSnapshot(db(), agents);
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

app.post("/api/chat", requireAuth, (req: Request, res: Response) => {
  const input = sanitizeChatInput(req.body);
  if (!input) {
    res.status(400).json({ error: "Messaggio vuoto" });
    return;
  }
  const msg: ChatMessage = { id: randomUUID(), author: input.author, text: input.text, ts: Date.now() };
  try {
    insertChatMessage(db(), msg);
    // Rimbalza a tutte le viste (fuori da recordEvent: non è un evento runtime).
    writeToClients(`data: ${JSON.stringify({ agentId: "chat", agentName: "chat", chat: msg })}\n\n`);
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
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

app.post("/api/routines", requireAuth, (req: Request, res: Response) => {
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

app.post("/api/routines/:id/toggle", requireAuth, (req: Request, res: Response) => {
  const id = req.params.id as string;
  const enabled = req.body?.enabled !== false;
  try {
    setRoutineEnabled(db(), id, enabled);
    res.json({ ok: true, id, enabled });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.delete("/api/routines/:id", requireAuth, (req: Request, res: Response) => {
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
});
