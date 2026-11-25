// Permessi per gruppo di strumenti, per agente (idea 2 da Paperclip, scelta B del 25/11/2026).
//
// Sette gruppi, tre posizioni: Consentito / Chiedi prima / Spento. Scelta dell'utente: si
// parte da "Chiedi prima" su tutto, come Paperclip; si cambia dalla scheda dell'agente o
// quando arriva la richiesta («Approva sempre» sposta il gruppo su Consentito).
// "Spento": lo strumento non viene nemmeno offerto all'agente (e se lo chiama lo stesso,
// il server lo rifiuta). "Chiedi prima": l'agente si ferma finché una persona decide.
// Gli strumenti interni (piano, memoria, passaggio di lavoro, done) non hanno gruppo.

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
  const rows = await db.all<{ grp: string; mode: string; by: string; at: number }>(
    `SELECT grp, mode, updated_by AS by, updated_at AS at FROM agent_permissions WHERE agent_id = ?`,
    [agentId],
  );
  return rows
    .filter((r) => isPermGroup(r.grp) && isPermMode(r.mode))
    .map((r) => ({ group: r.grp as PermGroup, mode: r.mode as PermMode, updatedBy: String(r.by ?? ""), updatedAt: Number(r.at) }));
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

/** Una persona ha deciso. false se l'agente non aspettava nulla. */
export function answerPermission(agentId: string, decision: PermDecision): boolean {
  return settle(agentId, decision);
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

/** Breve descrizione dell'azione chiesta, per la persona che decide. */
export function describeCall(tool: string, args: Record<string, unknown>): string {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  if (tool === "gh_read_files" && Array.isArray(args.paths)) return `${tool}: ${args.paths.slice(0, 5).map(String).join(", ")}${args.paths.length > 5 ? "…" : ""}`;
  if (tool === "gh_write_files" && Array.isArray(args.files)) {
    const paths = (args.files as Array<{ path?: unknown }>).map((f) => s(f?.path)).filter(Boolean);
    return `${tool}: ${paths.slice(0, 5).join(", ")}${paths.length > 5 ? "…" : ""}`;
  }
  const key = s(args.path) || s(args.url) || s(args.workflow) || s(args.title) || (args.pr_number != null ? `PR #${String(args.pr_number)}` : "") || s(args.query) || s(args.tool);
  return key ? `${tool}: ${key.slice(0, 160)}` : tool;
}
