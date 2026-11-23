// Stanze iconiche (23/11): che azione sta facendo un agente, dal nome dello strumento.
// La pagina la usa per mettere l'agente nella stanza giusta: Biblioteca (read),
// Officina (write), Laboratorio (test). Gli strumenti senza fase lasciano quella di prima.

export type Activity = "read" | "write" | "test";

const BY_TOOL: Record<string, Activity> = {
  gh_list_files: "read",
  gh_read_file: "read",
  gh_read_files: "read",
  gh_list_issues: "read",
  gh_list_prs: "read",
  gh_read_pr: "read",
  gh_pr_status: "read",
  notion_read: "read",
  recall: "read",
  web_fetch: "read",
  announce_plan: "read",
  gh_write_file: "write",
  gh_write_files: "write",
  gh_create_issue: "write",
  gh_comment_pr: "write",
  notion_write: "write",
  notion_create_page: "write",
  notion_replace_page: "write",
  notion_add_row: "write",
  notion_update_row: "write",
  remember: "write",
  gh_list_ci: "test",
  gh_ci_jobs: "test",
  gh_trigger_workflow: "test",
};

export function activityForTool(name: string): Activity | null {
  return Object.hasOwn(BY_TOOL, name) ? BY_TOOL[name] : null;
}

/** Righe principali dei risultati CI (quelle con l'icona di stato, non gli step rientrati). */
const STATUS_LINE = /^(✅|❌|🔄|⏳)/u;

/**
 * Esito dei test leggibile dal risultato di `gh_list_ci` (`runs`: conta il run più recente,
 * il primo) o di `gh_ci_jobs` (`jobs`: basta un job fallito; tutti riusciti = successo).
 * `null` se non c'è un esito chiaro (run in corso, errore, repo senza CI).
 */
export function ciOutcome(result: string, mode: "runs" | "jobs"): "success" | "failure" | null {
  const icons = result.split("\n").map((l) => l.match(STATUS_LINE)?.[1]).filter((i): i is string => !!i);
  if (icons.length === 0) return null;
  if (mode === "runs") return icons[0] === "✅" ? "success" : icons[0] === "❌" ? "failure" : null;
  if (icons.includes("❌")) return "failure";
  return icons.every((i) => i === "✅") ? "success" : null;
}
