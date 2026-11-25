// Permessi per gruppo di strumenti, per agente (idea 2 da Paperclip, scelta B del 25/11/2026).
//
// Sette gruppi, tre posizioni: Consentito / Chiedi prima / Spento. Scelta dell'utente: si
// parte da "Chiedi prima" su tutto, come Paperclip; si cambia dalla scheda dell'agente o
// quando arriva la richiesta («Approva sempre» sposta il gruppo su Consentito).
// "Spento": lo strumento non viene nemmeno offerto all'agente (e se lo chiama lo stesso,
// il server lo rifiuta). "Chiedi prima": l'agente si ferma finché una persona decide.
// Gli strumenti interni (piano, memoria, passaggio di lavoro, done) non hanno gruppo.

import { randomUUID } from "node:crypto";
import type { SqlDriver, SqlRunner } from "./sql";

export type PermGroup = "read" | "write" | "pr" | "workflow" | "web" | "notion" | "mcp";
export type PermMode = "allow" | "ask" | "off";
export type Permissions = Record<PermGroup, PermMode>;

export const PERM_GROUPS: ReadonlyArray<{ id: PermGroup; label: string; tools: readonly string[] }> = [
  {
    id: "read",
    label: "Leggere (file, PR, issue, CI)",
    tools: ["gh_list_files", "gh_read_file", "gh_read_files", "gh_list_issues", "gh_list_prs", "gh_read_pr", "gh_pr_status", "gh_list_ci", "gh_ci_jobs"],
  },
  { id: "write", label: "Scrivere file", tools: ["gh_write_file", "gh_write_files"] },
  { id: "pr", label: "PR, issue e merge", tools: ["gh_create_issue", "gh_comment_pr", "gh_merge_pr"] },
  { id: "workflow", label: "Avviare workflow", tools: ["gh_trigger_workflow"] },
  { id: "web", label: "Web", tools: ["web_fetch"] },
  { id: "notion", label: "Notion", tools: ["notion_read", "notion_write", "notion_create_page", "notion_replace_page", "notion_add_row", "notion_update_row"] },
  { id: "mcp", label: "Strumenti esterni (MCP)", tools: ["mcp_call"] },
];

export const DEFAULT_MODE: PermMode = "ask";
const MODES: readonly PermMode[] = ["allow", "ask", "off"];

export function isPermGroup(v: unknown): v is PermGroup {
  return typeof v === "string" && PERM_GROUPS.some((g) => g.id === v);
}
export function isPermMode(v: unknown): v is PermMode {
  return typeof v === "string" && (MODES as readonly string[]).includes(v);
}

export function defaultPermissions(): Permissions {
  return Object.fromEntries(PERM_GROUPS.map((g) => [g.id, DEFAULT_MODE])) as Permissions;
}

/** Gruppo di uno strumento, o null per quelli interni (sempre consentiti). */
export function groupOfTool(tool: string): PermGroup | null {
  return PERM_GROUPS.find((g) => g.tools.includes(tool))?.id ?? null;
}

export function groupLabel(g: PermGroup): string {
  return PERM_GROUPS.find((x) => x.id === g)?.label ?? g;
}

/** Toglie gli strumenti dei gruppi spenti: l'agente non li vede nemmeno. */
export function filterOffTools<T extends { name: string }>(specs: T[], perms: Permissions | undefined): T[] {
  if (!perms) return specs;
  return specs.filter((s) => {
    const g = groupOfTool(s.name);
    return !g || perms[g] !== "off";
  });
}

// --- database ----------------------------------------------------------------------

const SQLITE_DDL = `
  CREATE TABLE IF NOT EXISTS agent_permissions (
    agent_id   TEXT    NOT NULL,
    grp        TEXT    NOT NULL,
    mode       TEXT    NOT NULL,
    updated_by TEXT    NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (agent_id, grp)
  );
`;
const MYSQL_DDL = `
  CREATE TABLE IF NOT EXISTS agent_permissions (
    agent_id   VARCHAR(191) NOT NULL,
    grp        VARCHAR(16)  NOT NULL,
    mode       VARCHAR(8)   NOT NULL,
    updated_by VARCHAR(255) NOT NULL DEFAULT '',
    updated_at BIGINT       NOT NULL,
    PRIMARY KEY (agent_id, grp)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
`;

export async function ensurePermissionTables(db: SqlDriver): Promise<void> {
  await db.exec(db.dialect === "mysql" ? MYSQL_DDL : SQLITE_DDL);
}

export interface PermissionRow {
  group: PermGroup;
  mode: PermMode;
  updatedBy: string;
  updatedAt: number;
}

/** Permessi dell'agente: i gruppi mai toccati valgono il default ("Chiedi prima"). */
export async function loadPermissions(db: SqlRunner, agentId: string): Promise<Permissions> {
  const out = defaultPermissions();
  for (const r of await permissionRows(db, agentId)) out[r.group] = r.mode;
  return out;
}

/** Le scelte salvate, con chi le ha fatte e quando. */
export async function permissionRows(db: SqlRunner, agentId: string): Promise<PermissionRow[]> {
  // "by" è una parola riservata in MySQL: l'alias è "who".
  const rows = await db.all<{ grp: string; mode: string; who: string; at: number }>(
    `SELECT grp, mode, updated_by AS who, updated_at AS at FROM agent_permissions WHERE agent_id = ?`,
    [agentId],
  );
  return rows
    .filter((r) => isPermGroup(r.grp) && isPermMode(r.mode))
    .map((r) => ({ group: r.grp as PermGroup, mode: r.mode as PermMode, updatedBy: String(r.who ?? ""), updatedAt: Number(r.at) }));
}

export async function setPermission(db: SqlRunner, agentId: string, group: PermGroup, mode: PermMode, by: string, now = Date.now()): Promise<void> {
  const upd =
    db.dialect === "mysql"
      ? `ON DUPLICATE KEY UPDATE mode = VALUES(mode), updated_by = VALUES(updated_by), updated_at = VALUES(updated_at)`
      : `ON CONFLICT (agent_id, grp) DO UPDATE SET mode = excluded.mode, updated_by = excluded.updated_by, updated_at = excluded.updated_at`;
  await db.run(
    `INSERT INTO agent_permissions (agent_id, grp, mode, updated_by, updated_at) VALUES (?, ?, ?, ?, ?) ${upd}`,
    [agentId, group, mode, by.slice(0, 255), now],
  );
}

// --- richieste in attesa ("Chiedi prima") -----------------------------------------

export type PermDecision = "once" | "always" | "deny";
export type PermOutcome = PermDecision | "cancel" | "timeout";

export interface PermissionRequest {
  /** id della singola richiesta: la risposta vale solo per questa (non per una arrivata dopo) */
  id: string;
  agentId: string;
  agentName: string;
  group: PermGroup;
  groupLabel: string;
  tool: string;
  /** cosa vuole fare, in breve (es. "read src/app.ts") */
  detail: string;
  since: number;
}

/** Senza risposta per mezz'ora l'azione si considera negata (l'agente va avanti o chiude). */
export const PERMISSION_TIMEOUT_MS = 30 * 60 * 1000;

const waiting = new Map<string, { req: PermissionRequest; resolve: (o: PermOutcome) => void; timer: ReturnType<typeof setTimeout> }>();

export function newRequestId(): string {
  return randomUUID();
}

/** L'agente chiede il permesso e aspetta. Una richiesta alla volta per agente. */
export function askPermission(req: PermissionRequest, timeoutMs = PERMISSION_TIMEOUT_MS): Promise<PermOutcome> {
  settle(req.agentId, "cancel"); // non dovrebbe succedere: una richiesta vecchia non resta appesa
  return new Promise((resolve) => {
    const timer = setTimeout(() => settle(req.agentId, "timeout"), timeoutMs);
    (timer as { unref?: () => void }).unref?.();
    waiting.set(req.agentId, { req, resolve, timer });
  });
}

function settle(agentId: string, outcome: PermOutcome): boolean {
  const w = waiting.get(agentId);
  if (!w) return false;
  waiting.delete(agentId);
  clearTimeout(w.timer);
  w.resolve(outcome);
  return true;
}

/**
 * Una persona ha deciso sulla richiesta `requestId`. Controllo e sblocco nello stesso passo
 * (niente await in mezzo): se nel frattempo l'agente ha chiesto altro, la risposta non vale
 * per la richiesta nuova. Ritorna la richiesta decisa, o null.
 */
export function answerPermission(agentId: string, requestId: string, decision: PermDecision): PermissionRequest | null {
  const w = waiting.get(agentId);
  if (!w || w.req.id !== requestId) return null;
  settle(agentId, decision);
  return w.req;
}

/** Task annullato: chi aspettava si sblocca e il ciclo dell'agente si ferma. */
export function cancelPermission(agentId: string): void {
  settle(agentId, "cancel");
}

export function pendingPermission(agentId: string): PermissionRequest | null {
  return waiting.get(agentId)?.req ?? null;
}

export function allPendingPermissions(): PermissionRequest[] {
  return [...waiting.values()].map((w) => w.req);
}

/** Campi che decidono *cosa* fa l'azione: si mostrano per primi e non si accorciano mai. */
const KEY_FIELDS = ["server", "tool", "path", "paths", "files", "url", "workflow", "ref", "pr_number", "method", "repo", "database", "page_title", "title"];
/** Testi liberi lunghi (contenuti, messaggi): questi sì si accorciano. */
const TEXT_MAX = 200;
const ARRAY_MAX = 20;
const SECRET_KEY = /token|secret|password|passwd|api[_-]?key|authorization|cookie|credential/i;

const hidden = (v: string) => `[nascosto: ${v.length} caratteri]`;

/**
 * Nasconde in una URL solo le credenziali: la password di utente:password@ e i *valori*
 * dei parametri con un nome da credenziale. Tutto il resto (host, percorso, altri
 * parametri) resta visibile a chi decide.
 */
function redactUrl(v: string): string {
  return v
    .replace(/(\w+:\/\/[^/:@\s]*):([^/@\s]+)@/g, (_m, pre: string, pw: string) => `${pre}:${hidden(pw)}@`)
    .replace(/([?&])([^=&#\s]+)=([^&#\s]*)/g, (m, sep: string, name: string, val: string) => (SECRET_KEY.test(name) && val ? `${sep}${name}=${hidden(val)}` : m));
}

/**
 * Cosa vuole fare l'agente, per la persona che decide: lo strumento e **tutti** gli argomenti
 * così come arrivano all'esecuzione (non un campo scelto da noi, che il modello potrebbe
 * riempire per far sembrare innocua un'altra azione). I campi che decidono l'azione vengono
 * per primi e interi; si accorciano solo i testi liberi lunghi e le liste oltre 20 voci,
 * dicendo cosa manca. Le credenziali non si mostrano (la richiesta passa anche nel registro).
 */
export function describeCall(tool: string, args: Record<string, unknown>): string {
  // `secret`: siamo sotto un nome da credenziale (anche più in giù, in liste e oggetti).
  const show = (key: string, v: unknown, depth: number, under = false): unknown => {
    const secret = under || (SECRET_KEY.test(key) && !KEY_FIELDS.includes(key));
    if (typeof v === "string") {
      // Dei valori da credenziale si dice solo che c'erano e quanto erano lunghi.
      if (secret) return hidden(v);
      const r = /^https?:\/\//i.test(v) ? redactUrl(v) : v;
      return KEY_FIELDS.includes(key) || r.length <= TEXT_MAX ? r : `${r.slice(0, TEXT_MAX - 1)}… (+${r.length - TEXT_MAX + 1} caratteri)`;
    }
    if (depth > 4) return "…";
    if (Array.isArray(v)) {
      const items = v.slice(0, ARRAY_MAX).map((x) => show(key, x, depth + 1, secret));
      return v.length > ARRAY_MAX ? [...items, `… (+${v.length - ARRAY_MAX} voci)`] : items;
    }
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, show(k, x, depth + 1, secret)]));
    }
    return secret && v != null ? "[nascosto]" : v;
  };
  const keys = Object.keys(args).sort((a, b) => {
    const ia = KEY_FIELDS.indexOf(a), ib = KEY_FIELDS.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  let json: string;
  try {
    json = JSON.stringify(Object.fromEntries(keys.map((k) => [k, show(k, args[k], 0)])));
  } catch {
    json = "(argomenti non leggibili)";
  }
  return `${tool} ${json}`;
}

// --- cambi a task in corso ----------------------------------------------------------

/**
 * Ultima scelta per gruppo cambiata mentre il server gira: vale anche per i task già
 * partiti (spegnere un gruppo a metà task lo spegne subito, non dal task dopo).
 */
const liveModes = new Map<string, Partial<Permissions>>();

export function noteLiveMode(agentId: string, group: PermGroup, mode: PermMode): void {
  liveModes.set(agentId, { ...(liveModes.get(agentId) ?? {}), [group]: mode });
}

/** La posizione da usare adesso: quella cambiata dal vivo, altrimenti quella letta all'avvio del task. */
export function currentMode(agentId: string, group: PermGroup, atStart: Permissions): PermMode {
  return liveModes.get(agentId)?.[group] ?? atStart[group];
}

/** Solo per i test. */
export function resetLiveModes(): void {
  liveModes.clear();
}
