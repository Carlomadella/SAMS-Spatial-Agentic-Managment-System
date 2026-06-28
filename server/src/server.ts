import express, { type NextFunction, type Request, type Response } from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getSettings, isReady, publicStatus, updateSettings, type SettingsPatch } from "./config";
import { provision } from "./provision";
import { runTask } from "./sessions";
import { runGeminiTask } from "./agent";
import { runGroqTask } from "./groq";
import { addIssueLabel, createBranch, createPullRequest, listIssues, readFile, removeIssueLabel, writeFile } from "./github";
import { claimIssue, getClaims, getSimLabel, releaseIssue, simEnabled, simStatus, startSim, stopSim } from "./simLoop";
import { HttpError } from "./http";
import { getPending, clearPending } from "./pendingBuffer";
import { registerGardenRoutes } from "./garden/routes";
import { initGardenStore } from "./garden/store";
import { metricsSnapshot, recordEvent } from "./metrics";
import { db, recentTasks, taskStats } from "./db";
import type { AssignBody, WireEvent } from "./types";

const app = express();

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
app.post("/api/settings", (req: Request, res: Response) => {
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

app.post("/api/assign", (req: Request, res: Response) => {
  const body = req.body as AssignBody;
  if (!body?.agentId || !body?.title) {
    res.status(400).json({ error: "agentId and title are required" });
    return;
  }
  if (!isReady()) {
    res.status(503).json({ error: "Runtime non pronto — apri le Impostazioni, salva le chiavi e premi 'Provisiona agenti'." });
    return;
  }
  res.json({ ok: true });

  const { provider } = getSettings();
  const runner = provider === "gemini" ? runGeminiTask : provider === "groq" ? runGroqTask : runTask;
  runner(body, broadcast).catch((err: unknown) => {
    broadcast({
      agentId: body.agentId,
      agentName: body.agentName || body.agentId,
      status: "blocked",
      level: "ERROR",
      message: `Errore: ${err instanceof Error ? err.message : String(err)}`,
    });
  });
});

/** Approve staged files: create branch, commit each file, optionally open a PR. */
app.post("/api/approve/:agentId", async (req: Request, res: Response) => {
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
    for (const f of work.files) {
      await writeFile(f.path, f.content, work.branch, f.message);
      broadcast({ agentId, agentName, level: "SUCCESS", message: `write ${f.path}` });
    }
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
app.post("/api/reject/:agentId", (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;
  clearPending(agentId);
  broadcast({ agentId, agentName: "runtime", status: "idle", level: "WARN", message: "Diff rifiutato — nessuna modifica applicata" });
  res.json({ ok: true });
});

// --- Live Simulation mode ------------------------------------------------

app.get("/api/sim/status", (_req: Request, res: Response) => {
  res.json(simStatus());
});

app.post("/api/sim/start", (req: Request, res: Response) => {
  const label =
    typeof req.body?.label === "string" && req.body.label.trim()
      ? req.body.label.trim()
      : "sams";
  startSim(label);
  broadcast({ agentId: "sim", agentName: "sim", level: "INFO", message: `🟢 Live Sim avviata · label: ${label}` });
  res.json(simStatus());
});

app.post("/api/sim/stop", (_req: Request, res: Response) => {
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
  releaseIssue(issueNumber);
  void removeIssueLabel(issueNumber, "sams:in-progress").catch(() => {});
  res.json({ ok: true });
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
  console.error("Errore non gestito:", err);
  res.status(500).json({ error: "Errore interno del runtime" });
});

// Last-resort safety net so a stray rejection logs instead of crashing silently.
process.on("unhandledRejection", (reason) => console.error("UnhandledRejection:", reason));

const { port, githubRepo } = getSettings();
app.listen(port, () => {
  console.log(`SAMS runtime → http://localhost:${port}`);
  console.log(`  repo:  ${githubRepo}`);
  console.log(`  ready: ${isReady()}`);
  void initGardenStore()
    .then((k) => console.log(`  garden store: ${k}`))
    .catch((err) => console.error("  garden store init fallito:", err));
});
