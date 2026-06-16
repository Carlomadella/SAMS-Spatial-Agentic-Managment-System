import express, { type Request, type Response } from "express";
import cors from "cors";
import { config, isConfigured } from "./config";
import { runTask } from "./sessions";
import type { AssignBody, WireEvent } from "./types";

const app = express();
app.use(cors());
app.use(express.json());

/** Connected SSE clients (the SAMS browser UIs). */
const clients = new Set<Response>();

function broadcast(e: WireEvent): void {
  const line = `data: ${JSON.stringify(e)}\n\n`;
  for (const res of clients) res.write(line);
}

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true, configured: isConfigured(), repo: config.githubRepo });
});

app.get("/api/events", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.write(": connected\n\n");
  clients.add(res);

  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);
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
  if (!isConfigured()) {
    res.status(503).json({ error: "runtime not configured — run `npm run setup` and fill server/.env" });
    return;
  }
  res.json({ ok: true });

  runTask(body, broadcast).catch((err: unknown) => {
    broadcast({
      agentId: body.agentId,
      agentName: body.agentName || body.agentId,
      status: "blocked",
      level: "ERROR",
      message: `Errore: ${err instanceof Error ? err.message : String(err)}`,
    });
  });
});

app.listen(config.port, () => {
  console.log(`SAMS runtime → http://localhost:${config.port}`);
  console.log(`  repo:       ${config.githubRepo}`);
  console.log(`  configured: ${isConfigured()}`);
});
