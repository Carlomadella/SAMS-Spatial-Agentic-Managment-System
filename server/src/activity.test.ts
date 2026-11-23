import { describe, expect, it } from "vitest";
import { activityForTool, ciOutcome } from "./activity";

// Stanze iconiche (23/11): il server dice che azione sta facendo l'agente, così la casa
// lo mette nella stanza giusta (Biblioteca, Officina, Laboratorio).
describe("activityForTool", () => {
  it("le letture vanno in Biblioteca", () => {
    for (const t of ["gh_list_files", "gh_read_file", "gh_read_files", "gh_list_issues", "gh_list_prs", "gh_read_pr", "gh_pr_status", "notion_read", "recall", "web_fetch", "announce_plan"]) {
      expect(activityForTool(t)).toBe("read");
    }
  });

  it("le scritture vanno in Officina", () => {
    for (const t of ["gh_write_file", "gh_write_files", "gh_create_issue", "gh_comment_pr", "notion_write", "notion_create_page", "notion_replace_page", "notion_add_row", "notion_update_row", "remember"]) {
      expect(activityForTool(t)).toBe("write");
    }
  });

  it("i test vanno in Laboratorio", () => {
    for (const t of ["gh_list_ci", "gh_ci_jobs", "gh_trigger_workflow"]) expect(activityForTool(t)).toBe("test");
  });

  it("gli strumenti senza fase e quelli sconosciuti non cambiano stanza", () => {
    for (const t of ["relay_task", "done", "gh_merge_pr", "mcp_call", "sconosciuto"]) expect(activityForTool(t)).toBeNull();
  });
});

describe("ciOutcome", () => {
  const runs = (...lines: string[]) => lines.join("\n");

  it("elenco dei run: conta solo il più recente (il primo)", () => {
    expect(ciOutcome(runs("✅ CI | completed/success | b | 2026-11-23\n   u", "❌ CI | completed/failure | b | 2026-11-22\n   u"), "runs")).toBe("success");
    expect(ciOutcome(runs("❌ CI | completed/failure | b | 2026-11-23\n   u"), "runs")).toBe("failure");
  });

  it("elenco dei run: un run ancora in corso non ha esito", () => {
    expect(ciOutcome("🔄 CI | in_progress | b | 2026-11-23\n   u", "runs")).toBeNull();
  });

  it("job di un run: basta un job fallito", () => {
    expect(ciOutcome("✅ build (success)\n❌ test (failure)\n    ✗ npm test ← FALLITO", "jobs")).toBe("failure");
    expect(ciOutcome("✅ build (success)\n✅ test (success)", "jobs")).toBe("success");
    expect(ciOutcome("✅ build (success)\n🔄 test (in_progress)", "jobs")).toBeNull();
  });

  it("un testo senza esiti (errore, repo senza CI) non ha esito", () => {
    expect(ciOutcome("ERRORE: run_id non valido", "jobs")).toBeNull();
    expect(ciOutcome("Nessun run della CI", "runs")).toBeNull();
  });
});
