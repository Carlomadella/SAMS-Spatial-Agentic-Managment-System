// Repo indicata per il singolo task (campo `repo` di /api/assign e della coda).
//
// Scelta dell'utente del 25/11 (idea 2 da Paperclip, «solo sulla repo selezionata»): gli
// agenti lavorano SOLO sulla repo selezionata — quella del server in ⚙, o quella scelta da
// chi lavora col proprio GitHub. L'unica eccezione è la repo di SAMS, su cui lavora il
// meta-agente. Non valgono più eccezioni per l'owner né l'elenco SAMS_TASK_REPOS
// (prima: collaudo 21/11, punto 4b).

export const SAMS_REPO = "Carlomadella/SAMS-Spatial-Agentic-Managment-System";
const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

export type RepoDecision = { ok: true; repo: string | null } | { ok: false; error: string };

/**
 * `selectedRepo`: la repo su cui lavora chi avvia il task (server o proprio GitHub).
 * Ritorna la repo da usare per il task (null = quella selezionata, senza override).
 */
export function decideTaskRepo(repo: unknown, selectedRepo: string): RepoDecision {
  // Override assente o malformato: si usa la repo selezionata.
  if (typeof repo !== "string" || !REPO_RE.test(repo)) return { ok: true, repo: null };
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  if (selectedRepo && same(repo, selectedRepo)) return { ok: true, repo: null };
  if (same(repo, SAMS_REPO)) return { ok: true, repo: SAMS_REPO }; // il meta-agente
  return {
    ok: false,
    error: `Gli agenti lavorano solo sulla repo selezionata${selectedRepo ? ` (${selectedRepo})` : ""}: ${repo} non è consentita. L'unica eccezione è il meta-agente sulla repo di SAMS. Per lavorare su un'altra repo, cambia quella selezionata in ⚙.`,
  };
}
