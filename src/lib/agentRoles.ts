/**
 * Ruoli degli agenti mostrati dall'inspector (Generalist, Tester, Revisore,
 * Documentatore, Architetto). Il ruolo è un'etichetta: serve al passaggio di lavoro
 * tra agenti (relay "al Tester…") ma non aggiunge vincoli, che dal 20/11/2026 stanno
 * solo nelle istruzioni dell'agente. I mondi salvati prima dell'attuale elenco hanno
 * agenti con ruoli vecchi (Backend, QA, Reviewer, DevOps, Workflows…): qui si
 * traducono nel ruolo equivalente. Un ruolo sconosciuto resta com'è.
 */
export const AGENT_ROLE_IDS = ["Generalist", "Tester", "Revisore", "Documentatore", "Architetto"] as const;

const ALIASES: Record<string, (typeof AGENT_ROLE_IDS)[number]> = {
  generalist: "Generalist",
  generalista: "Generalist",
  backend: "Generalist",
  frontend: "Generalist",
  fullstack: "Generalist",
  devops: "Generalist",
  workflows: "Generalist",
  tester: "Tester",
  qa: "Tester",
  revisore: "Revisore",
  reviewer: "Revisore",
  documentatore: "Documentatore",
  docs: "Documentatore",
  documentation: "Documentatore",
  architetto: "Architetto",
  architect: "Architetto",
};

export function canonicalRole(role: string): string {
  const r = role.trim();
  return ALIASES[r.toLowerCase()] ?? r;
}
