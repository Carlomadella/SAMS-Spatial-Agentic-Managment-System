import type { Express, Request, Response } from "express";
import { emptyGarden, water, type GardenState } from "./model";
import { fetchPushActivity } from "./events";
import { getStore } from "./store";
import { profileHtml } from "./svg";
import { createRateLimiter } from "../rateLimit";

const cleanUser = (raw: unknown): string =>
  String(raw ?? "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 39);
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Queste pagine sono pubbliche e ogni aggiornamento interroga GitHub col token del server:
 * senza un tetto chiunque potrebbe consumarne la quota (5000 richieste l'ora) e lasciare
 * gli agenti senza GitHub. Oltre il tetto si risponde con l'ultimo stato salvato.
 * Revisione di sicurezza 20/11/2026.
 */
const refreshLimiter = createRateLimiter(20, 60_000); // 20 aggiornamenti al minuto per IP

async function refreshOrStored(user: string, ip: string | undefined): Promise<GardenState> {
  if (refreshLimiter.hit(ip ?? "?")) return refresh(user);
  const prev = await getStore().get(user);
  if (prev) return prev;
  throw new Error("Troppe richieste, riprova tra un minuto");
}

async function refresh(user: string): Promise<GardenState> {
  const store = getStore();
  const prev = (await store.get(user)) ?? emptyGarden(user);
  const act = await fetchPushActivity(user, prev.lastSeen);
  const next = water(prev, act.newWaterings, act.latestSeen, today());
  await store.put(next);
  return next;
}

/** Commit Garden endpoints, served by the SAMS runtime (no separate app). */
export function registerGardenRoutes(app: Express): void {
  app.get("/api/garden/:user", async (req: Request, res: Response) => {
    const user = cleanUser(req.params.user);
    if (!user) {
      res.status(400).json({ error: "username non valido" });
      return;
    }
    try {
      res.json(await refreshOrStored(user, req.ip));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("non trovato")) {
        res.status(404).json({ error: msg });
        return;
      }
      const prev = await getStore().get(user);
      if (prev) res.json({ ...prev, note: msg });
      else res.status(502).json({ error: msg });
    }
  });

  app.get("/api/leaderboard", async (_req: Request, res: Response) => {
    res.json(await getStore().top(10));
  });

  app.get("/u/:user", async (req: Request, res: Response) => {
    const user = cleanUser(req.params.user);
    if (!user) {
      res.status(400).send("username non valido");
      return;
    }
    const origin = `${req.protocol}://${req.get("host") ?? "localhost"}`;
    try {
      res.type("html").send(profileHtml(await refreshOrStored(user, req.ip), origin));
    } catch {
      res.type("html").send(profileHtml((await getStore().get(user)) ?? emptyGarden(user), origin));
    }
  });
}
