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
  fetch(`/api/garden/${encodeURIComponent(user)}`).then((r) => json<GardenState>(r));

export const waterGarden = (user: string) =>
  fetch(`/api/garden/${encodeURIComponent(user)}/water`, { method: "POST" }).then((r) => json<GardenState>(r));

export const leaderboard = () => fetch(`/api/leaderboard`).then((r) => json<GardenState[]>(r));
