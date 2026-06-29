// ---------------------------------------------------------------------------
// Agent progression: completing real tasks earns XP, which unlocks levels.
// Pure helpers (no UI/three.js) so the curve and labels stay easy to test.
// ---------------------------------------------------------------------------

/** XP granted for each task an agent completes. */
export const XP_PER_TASK = 30;

export interface Level {
  level: number;
  /** Italian rank name shown in the UI. */
  name: string;
  /** Minimum cumulative XP to reach this level. */
  min: number;
}

/** Ranks, ascending. The last one is the cap. */
export const LEVELS: Level[] = [
  { level: 1, name: "Novizio", min: 0 },
  { level: 2, name: "Apprendista", min: 60 },
  { level: 3, name: "Esperto", min: 150 },
  { level: 4, name: "Veterano", min: 300 },
  { level: 5, name: "Maestro", min: 510 },
];

export interface LevelInfo {
  level: number;
  name: string;
  /** XP accumulated within the current level. */
  xpIntoLevel: number;
  /** XP span from this level to the next, or null at the cap. */
  xpForNext: number | null;
  /** 0..1 progress toward the next level (1 when capped). */
  progress: number;
}

/** Resolve cumulative XP into a level, its name and progress to the next rank. */
export function levelFromXp(xp: number): LevelInfo {
  const x = Math.max(0, Math.floor(xp));
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (x >= LEVELS[i].min) idx = i;
    else break;
  }
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const xpIntoLevel = x - cur.min;
  const xpForNext = next ? next.min - cur.min : null;
  const progress = next ? xpIntoLevel / (next.min - cur.min) : 1;
  return { level: cur.level, name: cur.name, xpIntoLevel, xpForNext, progress };
}
