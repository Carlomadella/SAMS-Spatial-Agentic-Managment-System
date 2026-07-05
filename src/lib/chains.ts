// Reazioni a catena — pipeline dichiarative. Oltre al `relay_task` puntuale che
// un agente può emettere a mano, una `ChainRule` rende automatica la staffetta:
// "quando un task che contiene <when> viene completato (facoltativamente da un
// certo ruolo), assegna un follow-up a <target>". Il completamento di un task
// diventa così un evento che ne innesca un altro. Logica pura e testabile; lo
// store tiene e persiste le regole, un `ChainBridge` le fa scattare al passaggio
// di un agente in "done".

export interface ChainRule {
  id: string;
  /** Sottostringa (case-insensitive) cercata nel titolo del task completato. Vuota = qualsiasi task. */
  when: string;
  /** Facoltativo: scatta solo se l'agente che ha completato ha questo ruolo (case-insensitive). Vuoto = qualsiasi. */
  fromRole: string;
  /** Ruolo o nome dell'agente che deve prendere il follow-up (risolto come un relay). */
  target: string;
  /** Titolo del task di follow-up. Il segnaposto `{task}` diventa il titolo completato. */
  title: string;
  /** Branch del follow-up (vuoto = "main"). */
  branch: string;
  enabled: boolean;
}

/** Il fatto scatenante: un task appena completato da un agente. */
export interface ChainTrigger {
  /** Titolo del task completato. */
  title: string;
  /** Ruolo dell'agente che l'ha completato. */
  role: string;
}

/** Titolo del follow-up: espande il segnaposto `{task}` col titolo completato. */
export function chainTitle(rule: Pick<ChainRule, "title">, trigger: Pick<ChainTrigger, "title">): string {
  return rule.title.replace(/\{task\}/g, trigger.title).trim();
}

/**
 * La regola scatta per questo completamento? Deve essere abilitata, avere un
 * target e un titolo, combaciare il filtro `when` (vuoto = qualsiasi) e il filtro
 * `fromRole` (vuoto = qualsiasi). Guardia anti-loop diretto: non scatta se il
 * follow-up prodotto è identico al task appena completato (evita A → A → A…).
 */
export function ruleMatches(rule: ChainRule, trigger: ChainTrigger): boolean {
  if (!rule.enabled) return false;
  if (!rule.target.trim() || !rule.title.trim()) return false;
  const when = rule.when.trim().toLowerCase();
  if (when && !trigger.title.toLowerCase().includes(when)) return false;
  const fromRole = rule.fromRole.trim().toLowerCase();
  if (fromRole && trigger.role.trim().toLowerCase() !== fromRole) return false;
  // guardia anti-loop: non re-innescare sul proprio stesso output
  if (chainTitle(rule, trigger).toLowerCase() === trigger.title.trim().toLowerCase()) return false;
  return true;
}

/** Tutte le regole (nell'ordine dato) che scattano per questo completamento. */
export function matchingChains(rules: ChainRule[], trigger: ChainTrigger): ChainRule[] {
  return rules.filter((r) => ruleMatches(r, trigger));
}

/** Descrizione umana breve di una regola, per la UI e il log. */
export function chainSummary(rule: Pick<ChainRule, "when" | "fromRole" | "target">): string {
  const when = rule.when.trim() ? `"${rule.when.trim()}"` : "qualsiasi task";
  const from = rule.fromRole.trim() ? ` da ${rule.fromRole.trim()}` : "";
  return `${when}${from} → ${rule.target.trim() || "?"}`;
}
