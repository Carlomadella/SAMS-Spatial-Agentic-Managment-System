// Adattamento della UI al ruolo del chiamante (Roadmap 4, frontiera #2).
// Il server risponde a `GET /api/whoami` con `{ role, enforced }`: qui vivono le
// funzioni *pure* che traducono quel ruolo in "cosa può fare la UI", così i
// componenti nascondono o disabilitano ciò che il ruolo non può compiere.
//
// Gerarchia (come `server/src/roles.ts`): viewer < editor < owner.
//  - viewer  → sola lettura (osserva il mondo, la dashboard pubblica).
//  - editor  → avvia lavoro (assegna/approva/rifiuta task, sim, chat) ma non tocca
//              le impostazioni/segreti.
//  - owner   → tutto, incluse config e provisioning.
//
// `enforced` dice se i token sono configurati sul server. Se non lo sono, il
// runtime è "dev aperto" e chiunque è owner: la UI non mostra nessun badge di
// ruolo (comportamento storico, retro-compatibile).

export type ViewerRole = "owner" | "editor" | "viewer";

const RANK: Record<ViewerRole, number> = { viewer: 0, editor: 1, owner: 2 };

/** Normalizza un valore ignoto a un ruolo valido; fallback prudente a `owner`
 *  (dev aperto), coerente col server che tratta l'assenza di token come owner. */
export function normalizeRole(value: unknown): ViewerRole {
  return value === "viewer" || value === "editor" || value === "owner" ? value : "owner";
}

/** True se `role` è almeno `min` nella gerarchia. */
export function roleAtLeast(role: ViewerRole, min: ViewerRole): boolean {
  return RANK[role] >= RANK[min];
}

/** Può avviare lavoro (assegnare/approvare task, sim, chat)? Editor o owner. */
export function canAssign(role: ViewerRole): boolean {
  return roleAtLeast(role, "editor");
}

/** Può toccare le impostazioni/segreti e il provisioning? Solo owner. */
export function canConfigure(role: ViewerRole): boolean {
  return roleAtLeast(role, "owner");
}

export interface RoleMeta {
  /** etichetta breve per il badge */
  label: string;
  /** emoji del badge */
  icon: string;
  /** testo esteso per il tooltip */
  title: string;
}

const META: Record<ViewerRole, RoleMeta> = {
  owner: { label: "Owner", icon: "👑", title: "Owner — controllo completo, incluse impostazioni e segreti" },
  editor: { label: "Editor", icon: "✏️", title: "Editor — puoi avviare lavoro, ma non toccare le impostazioni" },
  viewer: { label: "Sola lettura", icon: "👁", title: "Sola lettura — puoi osservare, non avviare lavoro" },
};

export function roleMeta(role: ViewerRole): RoleMeta {
  return META[role];
}
