// Reparto revisioni (scelta dell'utente del 21/11): dove una persona rilegge push e merge
// verso il branch principale e decide — Conferma, Rifiuta o Chiedi modifiche. Qui i pezzi
// puri, testabili senza rete; gli endpoint stanno in server.ts.

/** Branch su cui finisce una proposta per il principale quando la persona chiede modifiche. */
export function reviewBranchName(agentName: string, now = Date.now()): string {
  const slug = agentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "agente";
  return `sams/revisione/${slug}-${now.toString(36)}`;
}

/** Il task che l'agente riceve uscendo dal reparto con le note della persona. */
export function reviewTaskText(note: string, branch: string, prNumber?: number): string {
  const where = prNumber ? `sul branch ${branch} (PR #${prNumber})` : `sul branch ${branch}`;
  const back = prNumber
    ? `Quando hai finito chiedi di nuovo il merge con gh_merge_pr pr_number=${prNumber}: tornerai nel Reparto revisioni per la conferma.`
    : "Quando hai finito chiama done con un riassunto delle modifiche.";
  return `Modifiche chieste nel Reparto revisioni: una persona ha riletto il tuo lavoro ${where} e chiede: «${note}». ` +
    `Lavora ${where}, applica solo queste modifiche. ${back}`;
}
