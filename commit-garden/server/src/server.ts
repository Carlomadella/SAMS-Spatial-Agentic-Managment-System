import express, { type Request, type Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { config } from "./config";
import { getStore, initStore } from "./db";
import { emptyGarden, water, type GardenState } from "./garden";
import { fetchPushActivity } from "./github";
import { profileHtml } from "./svg";

const app = express();
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});
app.use(express.json());

function cleanUser(raw: unknown): string {
  return String(raw ?? "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 39);
}
const today = () => new Date().toISOString().slice(0, 10);

/** Load + refresh from GitHub + persist. Throws if the user can't be fetched. */
async function refresh(user: string): Promise<GardenState> {
  const store = getStore();
  const prev = (await store.get(user)) ?? emptyGarden(user);
  const act = await fetchPushActivity(user, prev.lastSeen);
  const next = water(prev, act.newWaterings, act.latestSeen, today());
  await store.put(next);
  return next;
}

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.get("/api/garden/:user", async (req: Request, res: Response) => {
  const user = cleanUser(req.params.user);
  if (!user) {
    res.status(400).json({ error: "username non valido" });
    return;
  }
  try {
    res.json(await refresh(user));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("non trovato")) {
      res.status(404).json({ error: msg });
      return;
    }
    // GitHub hiccup (rate limit, etc.) → return last known state if we have one
    const prev = await getStore().get(user);
    if (prev) res.json({ ...prev, note: msg });
    else res.status(502).json({ error: msg });
  }
});

/** Manual watering (for demos / testing without waiting for a real push). */
app.post("/api/garden/:user/water", async (req: Request, res: Response) => {
  const user = cleanUser(req.params.user);
  if (!user) {
    res.status(400).json({ error: "username non valido" });
    return;
  }
  const store = getStore();
  const prev = (await store.get(user)) ?? emptyGarden(user);
  const next = water(prev, 1, prev.lastSeen, today());
  await store.put(next);
  res.json(next);
});

app.get("/api/leaderboard", async (_req: Request, res: Response) => {
  res.json(await getStore().top(10));
});

/** Public, SEO-friendly profile page. */
app.get("/u/:user", async (req: Request, res: Response) => {
  const user = cleanUser(req.params.user);
  if (!user) {
    res.status(400).send("username non valido");
    return;
  }
  const origin = `${req.protocol}://${req.get("host") ?? `localhost:${config.port}`}`;
  try {
    const state = await refresh(user);
    res.type("html").send(profileHtml(state, origin));
  } catch {
    const prev = (await getStore().get(user)) ?? emptyGarden(user);
    res.type("html").send(profileHtml(prev, origin));
  }
});

// Serve the built client if present (production single-process).
const clientDist = path.resolve(process.cwd(), "../client/dist");
if (fs.existsSync(clientDist)) app.use(express.static(clientDist));

app.listen(config.port, async () => {
  const kind = await initStore();
  console.log(`🌱 Commit Garden API → http://localhost:${config.port}  (store: ${kind})`);
});
