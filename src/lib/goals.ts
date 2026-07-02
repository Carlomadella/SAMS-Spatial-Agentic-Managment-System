// Obiettivi a lungo termine — un agente può avere un "progetto": una milestone
// fatta di più task collegati, con una barra di avanzamento che persiste fra le
// sessioni. Ogni task completato dall'agente fa avanzare il suo obiettivo attivo.
// Logica pura e testabile; lo store tiene e persiste i `Goal`, un bridge li fa
// avanzare al completamento di un task.

export interface Goal {
  id: string;
  agentId: string;
  title: string;
  /** Numero di task da completare per raggiungere la milestone. */
  milestone: number;
  /** Task completati finora verso questo obiettivo. */
  completed: number;
  createdAt: number;
  /** true quando `completed >= milestone`. */
  done: boolean;
}

/** Avanzamento 0..1 verso la milestone. */
export function goalProgress(g: Pick<Goal, "completed" | "milestone">): number {
  if (g.milestone <= 0) return 1;
  return Math.min(1, g.completed / g.milestone);
}

export function isGoalComplete(g: Pick<Goal, "completed" | "milestone">): boolean {
  return g.completed >= g.milestone;
}

/** L'obiettivo attivo (non concluso) di un agente, o null. Il più vecchio prima. */
export function activeGoal(goals: Goal[], agentId: string): Goal | null {
  return goals.find((g) => g.agentId === agentId && !g.done) ?? null;
}

/** Avanza (immutabilmente) l'obiettivo attivo dell'agente di `by` task. */
export function advanceGoal(goals: Goal[], agentId: string, by = 1): Goal[] {
  const target = activeGoal(goals, agentId);
  if (!target) return goals;
  return goals.map((g) => {
    if (g.id !== target.id) return g;
    const completed = g.completed + by;
    return { ...g, completed, done: completed >= g.milestone };
  });
}

/** Riepilogo breve, es. "2/5 — Rifattorizza il modulo auth". */
export function goalSummary(g: Goal): string {
  return `${Math.min(g.completed, g.milestone)}/${g.milestone} — ${g.title}`;
}
