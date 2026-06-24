/** A plant grows through these stages as the user keeps pushing. */
export type Stage = "seed" | "sprout" | "sapling" | "bush" | "tree" | "blooming";

export interface GardenState {
  user: string;
  /** total waterings ≈ commits/pushes counted over time */
  waterings: number;
  /** consecutive days with at least one push */
  streak: number;
  /** YYYY-MM-DD of the last watering, for streak math */
  lastWateredDate: string | null;
  /** ISO timestamp of the most recent GitHub event we've already counted */
  lastSeen: string | null;
  stage: Stage;
  /** 0..100 progress toward the next stage */
  growth: number;
  /** true if watered today (plant looks fresh) */
  thirsty: boolean;
  updatedAt: string;
}

/** waterings needed to ENTER each stage. */
const THRESHOLDS: Array<[Stage, number]> = [
  ["blooming", 60],
  ["tree", 30],
  ["bush", 15],
  ["sapling", 6],
  ["sprout", 1],
  ["seed", 0],
];

export function stageFor(waterings: number): Stage {
  for (const [stage, min] of THRESHOLDS) if (waterings >= min) return stage;
  return "seed";
}

/** progress (0..100) from the current stage's threshold toward the next one. */
export function growthFor(waterings: number): number {
  const ascending = [...THRESHOLDS].reverse(); // seed→blooming
  for (let i = 0; i < ascending.length; i++) {
    const [, min] = ascending[i];
    const next = ascending[i + 1];
    if (!next) return 100; // blooming
    if (waterings < next[1]) {
      const span = next[1] - min;
      return Math.round(((waterings - min) / Math.max(1, span)) * 100);
    }
  }
  return 0;
}

export function emptyGarden(user: string): GardenState {
  return {
    user,
    waterings: 0,
    streak: 0,
    lastWateredDate: null,
    lastSeen: null,
    stage: "seed",
    growth: 0,
    thirsty: true,
    updatedAt: new Date().toISOString(),
  };
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

/**
 * Apply freshly-fetched push activity to a garden state.
 * `newWaterings` = number of new commits/pushes since `lastSeen`.
 */
export function water(
  prev: GardenState,
  newWaterings: number,
  latestSeen: string | null,
  today: string,
): GardenState {
  if (newWaterings <= 0) {
    const thirsty = prev.lastWateredDate !== today;
    return { ...prev, thirsty, updatedAt: new Date().toISOString() };
  }

  let streak = prev.streak;
  if (!prev.lastWateredDate) streak = 1;
  else {
    const d = dayDiff(prev.lastWateredDate, today);
    if (d === 0) streak = Math.max(1, prev.streak);
    else if (d === 1) streak = prev.streak + 1;
    else streak = 1; // missed a day → reset
  }

  const waterings = prev.waterings + newWaterings;
  return {
    ...prev,
    waterings,
    streak,
    lastWateredDate: today,
    lastSeen: latestSeen ?? prev.lastSeen,
    stage: stageFor(waterings),
    growth: growthFor(waterings),
    thirsty: false,
    updatedAt: new Date().toISOString(),
  };
}

export const STAGE_LABEL: Record<Stage, string> = {
  seed: "Seme",
  sprout: "Germoglio",
  sapling: "Alberello",
  bush: "Cespuglio",
  tree: "Albero",
  blooming: "In fiore",
};
