import type { GardenState, Stage } from "./garden";
import { STAGE_LABEL } from "./garden";

// Giardino di team — aggrega i giardini di tutti i contributor (la leaderboard)
// in un'unica vista: totali, media di crescita, uno "stadio di squadra" e una
// classifica. Tutto puro e testabile: la UI (`GardenView`) legge lo stesso
// `GardenState[]` che già usa per il prato 3D.

/** Ordine di crescita degli stadi (dal più giovane al più maturo). */
export const STAGE_ORDER: Stage[] = ["seed", "sprout", "sapling", "bush", "tree", "blooming"];

export interface TeamMember {
  user: string;
  stage: Stage;
  growth: number;
  waterings: number;
  streak: number;
  thirsty: boolean;
  /** Punteggio di classifica (vedi `memberScore`). */
  score: number;
}

export interface TeamGarden {
  /** Numero di giardini/contributor. */
  members: number;
  /** Somma delle innaffiature (≈ push totali). */
  totalWaterings: number;
  /** Crescita media 0..100 (arrotondata). */
  avgGrowth: number;
  /** Lo streak più lungo del team. */
  bestStreak: number;
  /** Quanti giardini sono assetati adesso. */
  thirsty: number;
  /** Stadio "di squadra", derivato dalla crescita media. */
  teamStage: Stage;
  /** Etichetta italiana dello stadio di squadra. */
  teamStageLabel: string;
  /** Quante piante per ciascuno stadio (per la distribuzione). */
  stageCounts: Record<Stage, number>;
  /** Contributor ordinati per punteggio, dal migliore. */
  ranking: TeamMember[];
}

/**
 * Punteggio di classifica: premia le innaffiature (lavoro cumulato), con un
 * bonus per lo streak (costanza) e la crescita (progresso). Deterministico.
 */
export function memberScore(g: Pick<GardenState, "waterings" | "streak" | "growth">): number {
  return g.waterings * 10 + g.streak * 5 + Math.round(g.growth);
}

/** Stadio di squadra a partire dalla crescita media 0..100. */
export function teamStageFromGrowth(avg: number): Stage {
  if (avg >= 100) return "blooming";
  if (avg >= 80) return "tree";
  if (avg >= 55) return "bush";
  if (avg >= 30) return "sapling";
  if (avg >= 10) return "sprout";
  return "seed";
}

function emptyStageCounts(): Record<Stage, number> {
  return { seed: 0, sprout: 0, sapling: 0, bush: 0, tree: 0, blooming: 0 };
}

/** Aggrega la leaderboard in un giardino di team. `board` può essere vuoto. */
export function buildTeamGarden(board: GardenState[]): TeamGarden {
  const stageCounts = emptyStageCounts();
  let totalWaterings = 0;
  let growthSum = 0;
  let bestStreak = 0;
  let thirsty = 0;

  for (const g of board) {
    stageCounts[g.stage] += 1;
    totalWaterings += g.waterings;
    growthSum += g.growth;
    if (g.streak > bestStreak) bestStreak = g.streak;
    if (g.thirsty) thirsty += 1;
  }

  const members = board.length;
  const avgGrowth = members > 0 ? Math.round(growthSum / members) : 0;
  const teamStage = teamStageFromGrowth(avgGrowth);

  const ranking: TeamMember[] = board
    .map((g) => ({
      user: g.user,
      stage: g.stage,
      growth: g.growth,
      waterings: g.waterings,
      streak: g.streak,
      thirsty: g.thirsty,
      score: memberScore(g),
    }))
    // punteggio decrescente; a parità, ordine alfabetico stabile
    .sort((a, b) => b.score - a.score || a.user.localeCompare(b.user));

  return {
    members,
    totalWaterings,
    avgGrowth,
    bestStreak,
    thirsty,
    teamStage,
    teamStageLabel: STAGE_LABEL[teamStage],
    stageCounts,
    ranking,
  };
}
