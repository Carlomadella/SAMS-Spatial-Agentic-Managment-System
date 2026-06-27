import express, { type Request, type Response } from "express";
import { getSettings, isReady, publicStatus, updateSettings, type SettingsPatch } from "./config";
import { provision } from "./provision";
import { runTask } from "./sessions";
import { runGeminiTask } from "./agent";
import { runGroqTask } from "./groq";
import { registerGardenRoutes } from "./garden/routes";
import { initGardenStore } from "./garden/store";
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
app.use(express.json());

/** Connected SSE clients (the SAMS browser UIs). */
const clients = new Set<Response>();

function broadcast(e: WireEvent): void {
  const line = `data: ${JSON.stringify(e)}\n\n`;
  for (const res of clients) res.write(line);
}

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true, ...publicStatus() });
});

/** Sanitized snapshot for the Settings UI (never returns the secret values). */
app.get("/api/status", (_req: Request, res: Response) => {
  res.json(publicStatus());
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

  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(heartbeat);
      clients.delete(res);
    }
  }, 25000);
  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
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

// Commit Garden lives inside the SAMS runtime (no separate app/port).
registerGardenRoutes(app);

const { port, githubRepo } = getSettings();
app.listen(port, () => {
  console.log(`SAMS runtime → http://localhost:${port}`);
  console.log(`  repo:  ${githubRepo}`);
  console.log(`  ready: ${isReady()}`);
  void initGardenStore().then((k) => console.log(`  garden store: ${k}`));
});
