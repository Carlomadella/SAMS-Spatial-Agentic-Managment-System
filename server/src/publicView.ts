import { timingSafeEqual } from "node:crypto";

// Dashboard pubblica read-only: uno snapshot condivisibile dello stato del
// mondo (runtime, metriche, giardini) senza poter assegnare task. Logica pura e
// testabile; l'endpoint in server.ts la caccia insieme. Il token di sola lettura
// (`SAMS_READONLY_TOKEN`) protegge il link se impostato; se vuoto è aperto.

/**
 * Autorizza l'accesso alla dashboard pubblica. Se `configured` è vuoto la
 * dashboard è **aperta** (ritorna true). Confronto a tempo costante.
 */
export function readonlyAuthorized(configured: string, provided: string | undefined): boolean {
  if (!configured) return true; // nessun token richiesto
  if (!provided) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(configured, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Stato del runtime già sanificato (sottoinsieme di `publicStatus`). */
export interface PublicStatusLike {
  provider: string;
  ready: boolean;
  repo: string;
  baseBranch: string;
  model: string;
}

export interface PublicMetricsLike {
  tasksStarted: number;
  tasksCompleted: number;
  errors: number;
  uptimeSec: number;
  lifetime?: { total: number; completed: number; tokens: number };
}

export interface PublicGardenLike {
  user: string;
  stage: string;
  growth: number;
  waterings: number;
}

export interface PublicSnapshot {
  generatedAt: number;
  runtime: {
    provider: string;
    ready: boolean;
    repo: string;
    baseBranch: string;
    model: string;
  };
  metrics: {
    tasksStarted: number;
    tasksCompleted: number;
    errors: number;
    uptimeSec: number;
    lifetimeTasks: number;
    lifetimeCompleted: number;
    lifetimeTokens: number;
  };
  garden: {
    contributors: number;
    totalWaterings: number;
    top: { user: string; stage: string; growth: number; waterings: number }[];
  };
  /** Riepilogo del mondo autorevole durevole (agenti / attivi / idle). */
  world: { agents: number; working: number; idle: number };
  /** Quante viste stanno guardando l'ufficio in questo momento (presence live). */
  viewers: number;
}

export interface PublicWorldLike { agents: number; working: number; idle: number }

export interface PublicSnapshotInput {
  status: PublicStatusLike;
  metrics: PublicMetricsLike;
  board: PublicGardenLike[];
  world?: PublicWorldLike;
  viewers?: number;
  now?: number;
}

/** Compone lo snapshot read-only. Nessun segreto, nessuna azione mutante. */
export function buildPublicSnapshot({ status, metrics, board, world, viewers, now = Date.now() }: PublicSnapshotInput): PublicSnapshot {
  const lifetime = metrics.lifetime ?? { total: 0, completed: 0, tokens: 0 };
  return {
    generatedAt: now,
    runtime: {
      provider: status.provider,
      ready: status.ready,
      repo: status.repo,
      baseBranch: status.baseBranch,
      model: status.model,
    },
    metrics: {
      tasksStarted: metrics.tasksStarted,
      tasksCompleted: metrics.tasksCompleted,
      errors: metrics.errors,
      uptimeSec: metrics.uptimeSec,
      lifetimeTasks: lifetime.total,
      lifetimeCompleted: lifetime.completed,
      lifetimeTokens: lifetime.tokens,
    },
    garden: {
      contributors: board.length,
      totalWaterings: board.reduce((sum, g) => sum + g.waterings, 0),
      top: board
        .slice()
        .sort((a, b) => b.waterings - a.waterings || a.user.localeCompare(b.user))
        .slice(0, 5)
        .map((g) => ({ user: g.user, stage: g.stage, growth: g.growth, waterings: g.waterings })),
    },
    world: world ?? { agents: 0, working: 0, idle: 0 },
    viewers: Math.max(0, Math.floor(viewers ?? 0)),
  };
}
