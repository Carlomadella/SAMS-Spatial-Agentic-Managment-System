// Repo indicata per il singolo task (campo `repo` di /api/assign, usato dal meta-agente).
//
// Collaudo 21/11, punto 4b (limite deciso dall'utente il 20/11; opzione B): un editor senza
// GitHub collegato poteva far lavorare un agente su qualsiasi repo raggiungibile dal token
// del server. Con il token del server ora valgono solo: la repo del server, SAMS stessa
// (meta-agente) e quelle che l'owner elenca in SAMS_TASK_REPOS. Chi lavora col proprio
// GitHub resta libero: il suo token vede solo le sue repo. L'owner non ha limiti.

export const SAMS_REPO = "Carlomadella/SAMS-Spatial-Agentic-Managment-System";
const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

export function taskRepoList(serverRepo: string, env: NodeJS.ProcessEnv = process.env): string[] {
  const extra = (env.SAMS_TASK_REPOS ?? "").split(",").map((x) => x.trim()).filter((x) => REPO_RE.test(x));
  return [...new Set([serverRepo, SAMS_REPO, ...extra].filter((x) => REPO_RE.test(x)))];
}

export type RepoDecision = { ok: true; repo: string | null } | { ok: false; error: string };

export function decideTaskRepo(
  repo: unknown,
  who: { usesOwnGithub: boolean; isOwner: boolean; serverRepo: string },
  env: NodeJS.ProcessEnv = process.env,
): RepoDecision {
  // Override assente o malformato: si usa la repo normale (come prima).
  if (typeof repo !== "string" || !REPO_RE.test(repo)) return { ok: true, repo: null };
  if (who.usesOwnGithub || who.isOwner) return { ok: true, repo };
  const list = taskRepoList(who.serverRepo, env);
  if (list.some((r) => r.toLowerCase() === repo.toLowerCase())) return { ok: true, repo };
  return {
    ok: false,
    error: `La repo ${repo} non è tra quelle consentite per i task con il GitHub del server (${list.join(", ")}). Collega il tuo GitHub o chiedi all'owner di aggiungerla a SAMS_TASK_REPOS.`,
  };
}
