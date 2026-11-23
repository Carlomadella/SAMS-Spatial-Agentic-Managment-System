// Limiti sull'avvio dei workflow GitHub da parte di un agente (collaudo 21/11, punto 4;
// limite di sicurezza deciso dall'utente il 20/11, «limitiamo»; opzioni B + C).
//
// Prima un agente poteva avviare qualsiasi workflow su qualsiasi ref, anche con
// «Richiedi approvazione» attivo. Ora:
//  - C: solo sul branch del task, mai sul branch base; se l'owner imposta SAMS_WORKFLOWS
//    (lista separata da virgole), solo i workflow in quella lista;
//  - B: con l'approvazione obbligatoria (o un task sul branch principale) il workflow non
//    parte: resta in attesa con i file e parte quando una persona approva.

export type WorkflowDecision =
  | { kind: "run" }
  | { kind: "defer" }
  | { kind: "refuse"; reason: string };

/** Workflow consentiti da SAMS_WORKFLOWS (nomi file o id); vuoto = tutti. */
export function allowedWorkflows(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.SAMS_WORKFLOWS ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function sameWorkflow(a: string, b: string): boolean {
  const norm = (x: string) => x.trim().toLowerCase().replace(/^\.github\/workflows\//, "");
  return norm(a) === norm(b);
}

export function decideWorkflow(
  req: { workflow: string; ref: string },
  task: {
    branch: string;
    /** branch base REALE del task (repo dell'utente o ambiente), non solo quello delle impostazioni */
    baseBranch: string;
    mustStage: boolean;
    /** altri branch mai consentiti: base delle impostazioni e branch degli ambienti Dev/Staging/Prod */
    protectedBranches?: string[];
  },
  env: NodeJS.ProcessEnv = process.env,
): WorkflowDecision {
  const allowed = allowedWorkflows(env);
  if (allowed.length > 0 && !allowed.some((w) => sameWorkflow(w, req.workflow))) {
    return {
      kind: "refuse",
      reason: `il workflow "${req.workflow}" non è tra quelli consentiti dall'owner (${allowed.join(", ")}).`,
    };
  }
  const guarded = new Set([task.baseBranch, ...(task.protectedBranches ?? [])].filter(Boolean));
  if (!task.branch || guarded.has(task.branch) || guarded.has(req.ref) || req.ref !== task.branch) {
    return {
      kind: "refuse",
      reason: task.branch && !guarded.has(task.branch)
        ? `un agente può avviare un workflow solo sul branch del suo task ("${task.branch}"), non su "${req.ref}".`
        : `questo task lavora su un branch protetto ("${task.branch || task.baseBranch}"): un agente non avvia workflow lì.`,
    };
  }
  return task.mustStage ? { kind: "defer" } : { kind: "run" };
}
