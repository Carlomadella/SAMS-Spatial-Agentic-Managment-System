// Budget e richieste per agente (idea 1 da Paperclip, scelta A + C del 25/11/2026).
//
// SAMS conta da sé le chiamate ai modelli: una riga per giorno, agente e provider con
// richieste e token. Il giorno è quello UTC, perché la quota gratuita di OpenRouter si
// azzera a mezzanotte UTC (l'01:00 in Italia). Il tetto globale non lo scrive l'utente:
// si ricava dal provider scelto. Con la quota quasi finita SAMS avvisa e basta; il solo
// blocco è il tetto *per agente*, facoltativo (vuoto = nessun tetto).

import type { SqlDriver, SqlRunner } from "./sql";

/** Giorno di conteggio (UTC, "AAAA-MM-GG"). */
export function usageDay(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Richieste al giorno dei modelli gratuiti di OpenRouter senza crediti sull'account. */
export const OPENROUTER_FREE_DAILY = 50;

/**
 * Tetto giornaliero di richieste ricavato dal provider (scelta dell'utente: non è un numero
 * da scrivere a mano). null = il provider non ha un tetto che SAMS conosca.
 */
export function providerDailyCap(provider: string, model: string): number | null {
  if (provider === "openrouter" && model.trim().endsWith(":free")) return OPENROUTER_FREE_DAILY;
  return null;
}

/** Percentuale del tetto dell'agente oltre la quale la scheda avvisa (come Paperclip). */
export const AGENT_CAP_WARN = 0.8;

export type AgentCapState = "none" | "ok" | "near" | "reached";

/** A che punto è un agente rispetto al suo tetto (0 o meno = nessun tetto). */
export function agentCapState(used: number, cap: number): AgentCapState {
  if (!(cap > 0)) return "none";
  if (used >= cap) return "reached";
  if (used >= cap * AGENT_CAP_WARN) return "near";
  return "ok";
}

/** Tetto per agente valido: intero 1..100000, altrimenti 0 (= nessun tetto). */
export function sanitizeCap(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100_000) : 0;
}

// --- schema ----------------------------------------------------------------------

const SQLITE_DDL = `
  CREATE TABLE IF NOT EXISTS llm_usage (
    day       TEXT    NOT NULL,
    agent_id  TEXT    NOT NULL,
    provider  TEXT    NOT NULL,
    requests  INTEGER NOT NULL DEFAULT 0,
    tokens    INTEGER NOT NULL DEFAULT 0,
    tasks     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, agent_id, provider)
  );
  CREATE TABLE IF NOT EXISTS agent_limits (
    agent_id    TEXT    PRIMARY KEY,
    request_cap INTEGER NOT NULL DEFAULT 0,
    updated_by  TEXT    NOT NULL DEFAULT '',
    updated_at  INTEGER NOT NULL
  );
`;

const MYSQL_DDL = `
  CREATE TABLE IF NOT EXISTS llm_usage (
    day       VARCHAR(10)  NOT NULL,
    agent_id  VARCHAR(191) NOT NULL,
    provider  VARCHAR(32)  NOT NULL,
    requests  BIGINT       NOT NULL DEFAULT 0,
    tokens    BIGINT       NOT NULL DEFAULT 0,
    tasks     BIGINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (day, agent_id, provider)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
  CREATE TABLE IF NOT EXISTS agent_limits (
    agent_id    VARCHAR(191) NOT NULL PRIMARY KEY,
    request_cap BIGINT       NOT NULL DEFAULT 0,
    updated_by  VARCHAR(255) NOT NULL DEFAULT '',
    updated_at  BIGINT       NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
`;

export async function ensureUsageTables(db: SqlDriver): Promise<void> {
  await db.exec(db.dialect === "mysql" ? MYSQL_DDL : SQLITE_DDL);
}

/** Somma richieste, token e task finiti alla riga (giorno, agente, provider). */
async function bump(db: SqlRunner, day: string, agentId: string, provider: string, requests: number, tokens: number, tasks: number): Promise<void> {
  const upd =
    db.dialect === "mysql"
      ? `ON DUPLICATE KEY UPDATE requests = requests + VALUES(requests), tokens = tokens + VALUES(tokens), tasks = tasks + VALUES(tasks)`
      : `ON CONFLICT (day, agent_id, provider) DO UPDATE SET requests = requests + excluded.requests, tokens = tokens + excluded.tokens, tasks = tasks + excluded.tasks`;
  await db.run(
    `INSERT INTO llm_usage (day, agent_id, provider, requests, tokens, tasks) VALUES (?, ?, ?, ?, ?, ?) ${upd}`,
    [day, agentId, provider.slice(0, 32), requests, Math.max(0, Math.floor(tokens) || 0), tasks],
  );
}

/** Una chiamata al modello fatta per un agente. */
export async function recordRequest(db: SqlRunner, agentId: string, provider: string, tokens: number, ts = Date.now()): Promise<void> {
  await bump(db, usageDay(ts), agentId, provider, 1, tokens, 0);
}

/** Un task dell'agente è finito (serve per la media di richieste per task). */
export async function recordTaskEnd(db: SqlRunner, agentId: string, ts = Date.now()): Promise<void> {
  await bump(db, usageDay(ts), agentId, "", 0, 0, 1);
}

export interface AgentUsage {
  /** richieste di oggi, tutti i provider */
  requests: number;
  tokens: number;
  /** richieste medie per task negli ultimi 7 giorni (0 = nessun task finito) */
  avgPerTask: number;
  /** tetto giornaliero dell'agente (0 = nessuno) */
  cap: number;
}

export interface UsageReport {
  day: string;
  /** richieste di oggi per provider, tutti gli agenti */
  byProvider: Record<string, number>;
  agents: Record<string, AgentUsage>;
}

const DAY_MS = 86_400_000;

/** Conteggi di oggi + medie della settimana + tetti, in una lettura. */
export async function usageReport(db: SqlRunner, now = Date.now()): Promise<UsageReport> {
  const day = usageDay(now);
  const weekStart = usageDay(now - 6 * DAY_MS);
  const today = await db.all<{ agentId: string; provider: string; requests: number; tokens: number }>(
    `SELECT agent_id AS agentId, provider, requests, tokens FROM llm_usage WHERE day = ?`,
    [day],
  );
  const week = await db.all<{ agentId: string; requests: number; tasks: number }>(
    `SELECT agent_id AS agentId, SUM(requests) AS requests, SUM(tasks) AS tasks FROM llm_usage WHERE day >= ? GROUP BY agent_id`,
    [weekStart],
  );
  const caps = await db.all<{ agentId: string; cap: number }>(`SELECT agent_id AS agentId, request_cap AS cap FROM agent_limits`);

  const agents: Record<string, AgentUsage> = {};
  const get = (id: string): AgentUsage => (agents[id] ??= { requests: 0, tokens: 0, avgPerTask: 0, cap: 0 });
  const byProvider: Record<string, number> = {};
  for (const r of today) {
    const n = Number(r.requests) || 0;
    if (!r.provider) continue; // riga dei task finiti
    byProvider[r.provider] = (byProvider[r.provider] ?? 0) + n;
    const a = get(String(r.agentId));
    a.requests += n;
    a.tokens += Number(r.tokens) || 0;
  }
  for (const r of week) {
    const tasks = Number(r.tasks) || 0;
    if (tasks > 0) get(String(r.agentId)).avgPerTask = Math.round((Number(r.requests) || 0) / tasks);
  }
  for (const r of caps) {
    const cap = Number(r.cap) || 0;
    if (cap > 0) get(String(r.agentId)).cap = cap;
  }
  return { day, byProvider, agents };
}

/** Richieste di oggi di un agente (tutti i provider). */
export async function agentRequestsToday(db: SqlRunner, agentId: string, now = Date.now()): Promise<number> {
  const r = await db.get<{ n: number }>(
    `SELECT COALESCE(SUM(requests), 0) AS n FROM llm_usage WHERE day = ? AND agent_id = ?`,
    [usageDay(now), agentId],
  );
  return Number(r?.n) || 0;
}

export async function getAgentCap(db: SqlRunner, agentId: string): Promise<number> {
  const r = await db.get<{ cap: number }>(`SELECT request_cap AS cap FROM agent_limits WHERE agent_id = ?`, [agentId]);
  return Number(r?.cap) || 0;
}

/** Imposta (o toglie, con 0) il tetto dell'agente, ricordando chi l'ha cambiato. */
export async function setAgentCap(db: SqlRunner, agentId: string, cap: number, by: string, now = Date.now()): Promise<void> {
  const c = sanitizeCap(cap);
  const upd =
    db.dialect === "mysql"
      ? `ON DUPLICATE KEY UPDATE request_cap = VALUES(request_cap), updated_by = VALUES(updated_by), updated_at = VALUES(updated_at)`
      : `ON CONFLICT (agent_id) DO UPDATE SET request_cap = excluded.request_cap, updated_by = excluded.updated_by, updated_at = excluded.updated_at`;
  await db.run(
    `INSERT INTO agent_limits (agent_id, request_cap, updated_by, updated_at) VALUES (?, ?, ?, ?) ${upd}`,
    [agentId, c, by.slice(0, 255), now],
  );
}

/** Frase per chi prova ad assegnare un task a un agente che ha raggiunto il tetto (o null). */
export function capBlockMessage(agentName: string, used: number, cap: number): string | null {
  if (agentCapState(used, cap) !== "reached") return null;
  return `${agentName} ha raggiunto il suo tetto di oggi (${used}/${cap} richieste). Alza il tetto nella sua scheda o aspetta che il conteggio si azzeri (mezzanotte UTC, l'01:00 in Italia d'inverno).`;
}
