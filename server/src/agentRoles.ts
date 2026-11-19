/**
 * Ruoli degli agenti riconosciuti dal runtime (Generalist, Tester, Revisore,
 * Documentatore, Architetto). I mondi salvati prima dell'attuale elenco hanno
 * agenti con ruoli vecchi (Backend, QA, Reviewer, DevOps, Workflows…): qui si
 * traducono nel ruolo equivalente, così il server applica i vincoli giusti e
 * l'inspector li mostra. Un ruolo sconosciuto resta com'è (nessun vincolo extra).
 * Tenere allineate le due copie: src/lib/agentRoles.ts e server/src/agentRoles.ts.
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
