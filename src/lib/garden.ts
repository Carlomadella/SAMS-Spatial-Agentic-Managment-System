// Client for the Commit Garden API (the separate commit-garden/server, :8088).
// Override with VITE_GARDEN_API if you host it elsewhere.
const BASE = ((import.meta.env.VITE_GARDEN_API as string | undefined) || "http://localhost:8088").replace(/\/$/, "");

export type Stage = "seed" | "sprout" | "sapling" | "bush" | "tree" | "blooming";

export interface GardenState {
  user: string;
  waterings: number;
  streak: number;
  lastWateredDate: string | null;
  lastSeen: string | null;
  stage: Stage;
  growth: number;
  thirsty: boolean;
  updatedAt: string;
  note?: string;
}

export const STAGE_LABEL: Record<Stage, string> = {
  seed: "Seme",
  sprout: "Germoglio",
  sapling: "Alberello",
  bush: "Cespuglio",
  tree: "Albero",
  blooming: "In fiore",
};

async function json<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      const d = (await r.json()) as { error?: string };
      if (d.error) msg = d.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await r.json()) as T;
}

export const getGarden = (user: string) =>
  fetch(`${BASE}/api/garden/${encodeURIComponent(user)}`).then((r) => json<GardenState>(r));

export const leaderboard = () => fetch(`${BASE}/api/leaderboard`).then((r) => json<GardenState[]>(r));

export const gardenProfileUrl = (user: string) => `${BASE}/u/${encodeURIComponent(user)}`;
