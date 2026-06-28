import express, { type NextFunction, type Request, type Response } from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getSettings, isReady, publicStatus, updateSettings, type SettingsPatch } from "./config";
import { log } from "./log";
import { provision } from "./provision";
import { runTask } from "./sessions";
import { runGeminiTask } from "./agent";
import { runGroqTask } from "./groq";
import { addIssueLabel, createBranch, createPullRequest, listIssues, readFile, removeIssueLabel, writeFilesAtomic } from "./github";
import { claimIssue, getClaims, getSimLabel, releaseByAgent, releaseIssue, simEnabled, simStatus, startSim, stopSim } from "./simLoop";
import { HttpError } from "./http";
import { getPending, clearPending } from "./pendingBuffer";
import { registerGardenRoutes } from "./garden/routes";
import { initGardenStore } from "./garden/store";
import { metricsSnapshot, recordEvent } from "./metrics";
import { clearMemory, db, listMemory, recentTasks, taskStats } from "./db";
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
app.use(express.json({ limit: "2mb" }));

/** Connected SSE clients (the SAMS browser UIs). */
const clients = new Set<Response>();
const HEARTBEAT_MS = 25000;

function broadcast(e: WireEvent): void {
  recordEvent(e);
  // Release the per-agent cooldown once a task reaches a terminal state.
  if (e.agentId && (e.status === "done" || e.status === "review" || e.status === "idle" || e.status === "blocked")) {
    lastAssign.delete(e.agentId);
  }
  const line = `data: ${JSON.stringify(e)}\n\n`;
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

  // Single cleanup path: a dead socket does NOT make res.write throw in Node, so
  // we must not rely on a throw — react to close/error and guard every write.
  function cleanup() {
    clearInterval(heartbeat);
    clients.delete(res);
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
  runner(body, broadcast).catch((err: unknown) => {
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

// GitHub webhook — receives push / pull_request / workflow_run events and
// re-broadcasts them as SAMS WireEvents so the frontend can react in real time.
// To connect: in GitHub → Repo Settings → Webhooks → add http://host/api/webhook/github
// (Content-Type: application/json; no Secret needed for local use).
app.post("/api/webhook/github", (req: Request, res: Response) => {
  const event = req.headers["x-github-event"] as string | undefined;
  if (!event) { res.status(400).json({ error: "x-github-event header missing" }); return; }
  res.json({ ok: true });

  const body = req.body as Record<string, unknown>;
  const repo = (body.repository as { full_name?: string } | undefined)?.full_name ?? "?";

  if (event === "push") {
    const ref = (body.ref as string | undefined) ?? "";
    const branch = ref.replace("refs/heads/", "");
    const pusher = (body.pusher as { name?: string } | undefined)?.name ?? "?";
    const commits = Array.isArray(body.commits) ? (body.commits as unknown[]).length : 0;
    broadcast({
      agentId: "github",
      agentName: "GitHub",
      level: "INFO",
      message: `Push su ${repo}/${branch} da ${pusher} (${commits} commit${commits !== 1 ? "s" : ""})`,
    });
  } else if (event === "pull_request") {
    const action = body.action as string | undefined;
    const pr = body.pull_request as { title?: string; html_url?: string; number?: number } | undefined;
    if (pr && (action === "opened" || action === "closed" || action === "merged")) {
      broadcast({
        agentId: "github",
        agentName: "GitHub",
        level: "SUCCESS",
        message: `PR #${pr.number ?? "?"} ${action}: ${pr.title ?? ""} — ${pr.html_url ?? ""}`,
      });
    }
  } else if (event === "workflow_run") {
    const run = body.workflow_run as { name?: string; conclusion?: string; html_url?: string } | undefined;
    const action = body.action as string | undefined;
    if (run && action === "completed") {
      const ok = run.conclusion === "success";
      broadcast({
        agentId: "github",
        agentName: "GitHub",
        level: ok ? "SUCCESS" : "ERROR",
        message: `CI "${run.name ?? "?"}" ${ok ? "✅ passata" : "❌ fallita"} — ${run.html_url ?? ""}`,
      });
    }
  } else {
    log.debug("GitHub webhook ignorato", { event });
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
});
