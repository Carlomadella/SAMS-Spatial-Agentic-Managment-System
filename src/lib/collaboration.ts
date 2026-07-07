// Protocolli di collaborazione — un "tavolo" dove più agenti contribuiscono allo
// stesso obiettivo con hand-off *espliciti* e ordinati. Dove la reazione a catena
// (`chains.ts`) è una regola globale e senza fine ("quando un task X è fatto →
// assegna a Y"), un **playbook** è una pipeline *bounded*: una sequenza numerata
// di stadi (ruolo → titolo del task) con un inizio, una fine e un avanzamento
// visibile. Avviarlo crea un `PlaybookRun` — lo *stato condiviso* del tavolo — che
// passa di stadio in stadio man mano che ciascun agente completa il suo pezzo.
//
// Logica pura e testabile: lo store tiene i playbook (persistiti) e le run in
// corso; un bridge, al passaggio di un agente in "done", avanza la run e assegna
// lo stadio successivo riusando lo stesso percorso di relay già verificato.

/** Uno stadio del tavolo: chi lo prende (ruolo o nome agente) e cosa fa. */
export interface CollabStage {
  /** Ruolo o nome dell'agente che prende questo stadio (risolto come un relay). */
  role: string;
  /** Titolo del task. Il segnaposto `{goal}` diventa l'obiettivo del tavolo. */
  title: string;
}

/** Un protocollo salvato: un modello riusabile di collaborazione. */
export interface Playbook {
  id: string;
  /** Nome del protocollo, per la UI e la palette. */
  name: string;
  /** Obiettivo condiviso, espanso in `{goal}` nei titoli degli stadi. */
  goal: string;
  /** Branch di lavoro comune agli stadi (vuoto = "main"). */
  branch: string;
  stages: CollabStage[];
}

/** L'istanza in corso di un playbook — lo stato condiviso del tavolo. */
export interface PlaybookRun {
  id: string;
  playbookId: string;
  /** Snapshot del nome (il playbook potrebbe cambiare dopo l'avvio). */
  name: string;
  goal: string;
  branch: string;
  /** Snapshot degli stadi al momento dell'avvio. */
  stages: CollabStage[];
  /** Indice dello stadio corrente; `=== stages.length` quando è finito. */
  stageIndex: number;
  startedAt: number;
  /** true quando tutti gli stadi sono stati completati. */
  done: boolean;
}

export const MAX_STAGES = 8;
export const MAX_PLAYBOOKS = 20;
const NAME_CAP = 60;
const GOAL_CAP = 120;
const TITLE_CAP = 120;
const ROLE_CAP = 40;

/** Ripulisce uno stadio; `null` se ruolo o titolo sono vuoti dopo il trim. */
export function sanitizeStage(input: Partial<CollabStage>): CollabStage | null {
  const role = (input.role ?? "").trim().slice(0, ROLE_CAP);
  const title = (input.title ?? "").trim().slice(0, TITLE_CAP);
  if (!role || !title) return null;
  return { role, title };
}

/**
 * Ripulisce l'input di un nuovo playbook: nome/obiettivo con cap, stadi validi
 * (fino a `MAX_STAGES`). Restituisce `null` se manca il nome o non resta almeno
 * uno stadio valido — un tavolo senza stadi non collabora.
 */
export function sanitizePlaybookInput(
  input: Partial<Omit<Playbook, "id">>,
): Omit<Playbook, "id"> | null {
  const name = (input.name ?? "").trim().slice(0, NAME_CAP);
  const goal = (input.goal ?? "").trim().slice(0, GOAL_CAP);
  const branch = (input.branch ?? "").trim();
  const stages = (input.stages ?? [])
    .map(sanitizeStage)
    .filter((s): s is CollabStage => s !== null)
    .slice(0, MAX_STAGES);
  if (!name || stages.length === 0) return null;
  return { name, goal, branch, stages };
}

/** Espande `{goal}` nel titolo di uno stadio con l'obiettivo del tavolo. */
export function expandStageTitle(stage: Pick<CollabStage, "title">, goal: string): string {
  return stage.title.replace(/\{goal\}/g, goal.trim()).trim();
}

/** Lo stadio corrente di una run, o `null` se è finita. */
export function currentStage(run: Pick<PlaybookRun, "stages" | "stageIndex">): CollabStage | null {
  return run.stages[run.stageIndex] ?? null;
}

/** true quando la run ha superato l'ultimo stadio. */
export function isRunComplete(run: Pick<PlaybookRun, "stages" | "stageIndex">): boolean {
  return run.stageIndex >= run.stages.length;
}

/** Avanzamento 0..1 verso l'ultimo stadio. */
export function runProgress(run: Pick<PlaybookRun, "stages" | "stageIndex">): number {
  if (run.stages.length === 0) return 1;
  return Math.min(1, run.stageIndex / run.stages.length);
}

/**
 * Crea la run iniziale di un playbook: snapshot di nome/obiettivo/stadi al primo
 * stadio (indice 0). Se il playbook non ha stadi, la run nasce già conclusa.
 */
export function startRun(playbook: Playbook, id: string, now: number): PlaybookRun {
  return {
    id,
    playbookId: playbook.id,
    name: playbook.name,
    goal: playbook.goal,
    branch: playbook.branch,
    stages: playbook.stages,
    stageIndex: 0,
    startedAt: now,
    done: playbook.stages.length === 0,
  };
}

/**
 * Avanza (immutabilmente) la run allo stadio successivo, segnandola `done` quando
 * supera l'ultimo. Una run già conclusa resta invariata (idempotente).
 */
export function advanceRun(run: PlaybookRun): PlaybookRun {
  if (run.done) return run;
  const stageIndex = run.stageIndex + 1;
  return { ...run, stageIndex, done: stageIndex >= run.stages.length };
}

/**
 * La run attiva (non conclusa) il cui stadio corrente combacia con un task appena
 * completato: stesso titolo espanso *e* ruolo dell'agente uguale al ruolo dello
 * stadio (case-insensitive; il match per nome resta al chiamante, come nei relay).
 * Restituisce la prima corrispondenza — un tavolo per volta avanza su un dato task.
 */
export function runMatching(
  runs: PlaybookRun[],
  completed: { title: string; role: string },
): PlaybookRun | undefined {
  const title = completed.title.trim().toLowerCase();
  const role = completed.role.trim().toLowerCase();
  return runs.find((run) => {
    if (run.done) return false;
    const stage = currentStage(run);
    if (!stage) return false;
    if (stage.role.trim().toLowerCase() !== role) return false;
    return expandStageTitle(stage, run.goal).toLowerCase() === title;
  });
}

/**
 * Modelli di tavolo pronti all'uso — punti di partenza comuni che l'utente può
 * aggiungere con un click e poi adattare. Ogni titolo usa `{goal}` così un solo
 * obiettivo scorre lungo tutta la pipeline. I ruoli sono generici (dev/reviewer/
 * qa/docs): `findRelayTarget` li risolve per ruolo *o* per nome, quindi funzionano
 * anche con agenti nominati diversamente purché il ruolo combaci.
 */
export const BUILTIN_PLAYBOOKS: ReadonlyArray<Omit<Playbook, "id">> = [
  {
    name: "Feature completa",
    goal: "",
    branch: "",
    stages: [
      { role: "dev", title: "Implementa {goal}" },
      { role: "reviewer", title: "Rivedi {goal}" },
      { role: "qa", title: "Testa {goal}" },
    ],
  },
  {
    name: "Bugfix",
    goal: "",
    branch: "",
    stages: [
      { role: "dev", title: "Riproduci e correggi {goal}" },
      { role: "qa", title: "Verifica la fix di {goal}" },
    ],
  },
  {
    name: "Docs & release",
    goal: "",
    branch: "",
    stages: [
      { role: "dev", title: "Prepara il rilascio di {goal}" },
      { role: "docs", title: "Aggiorna la documentazione di {goal}" },
      { role: "reviewer", title: "Rivedi note di rilascio e docs di {goal}" },
    ],
  },
];

/** Riepilogo breve di un playbook, es. "Rilascio · 3 stadi". */
export function playbookSummary(p: Pick<Playbook, "name" | "stages">): string {
  const n = p.stages.length;
  return `${p.name} · ${n} ${n === 1 ? "stadio" : "stadi"}`;
}

/** Etichetta di stato di una run, es. "Rilascio — 2/3" oppure "Rilascio — ✓". */
export function runLabel(run: Pick<PlaybookRun, "name" | "stages" | "stageIndex" | "done">): string {
  if (run.done) return `${run.name} — ✓`;
  return `${run.name} — ${run.stageIndex + 1}/${run.stages.length}`;
}
