// Ruoli/permessi sul workspace — Roadmap 4, frontiera #2.
//
// Finché il mondo era guardato da una persona sola bastava un unico token
// (SAMS_TOKEN): o ce l'hai e puoi tutto, o non ce l'hai. In un workspace
// condiviso serve distinguere *chi assegna lavoro* da *chi solo osserva*. Qui
// vive la logica pura, deterministica e testabile; le guardie HTTP e i token
// configurati stanno in `server.ts`/`config.ts`.
//
// Gerarchia: viewer < editor < owner.
//   - **owner**  (SAMS_TOKEN)          → tutto, incluse config/segreti.
//   - **editor** (SAMS_EDITOR_TOKEN)   → avvia lavoro (assegna, approva, sim,
//                                        routine, chat) ma non tocca le impostazioni.
//   - **viewer** (SAMS_READONLY_TOKEN) → solo lettura + dashboard pubblica.
//
// Retro-compatibilità: se NESSUN token è configurato il runtime è in modalità
// dev aperta e ogni richiesta è "owner" (come si comportava prima).

export type Role = "owner" | "editor" | "viewer";

/** Rango numerico per confronti d'ordine (più alto = più potere). */
const RANK: Record<Role, number> = { viewer: 0, editor: 1, owner: 2 };

/** I token configurati per ciascun tier (stringa vuota = tier non configurato). */
export interface RoleTokens {
  owner: string;
  editor: string;
  viewer: string;
}

/**
 * Estrae il token da un header `Authorization: Bearer <token>`.
 * Ritorna "" se l'header manca o non è nella forma attesa.
 */
export function bearerToken(header: string | undefined | null): string {
  if (typeof header !== "string") return "";
  const m = /^Bearer (.+)$/.exec(header.trim());
  return m ? m[1].trim() : "";
}

/**
 * Risolve il ruolo di una richiesta dai token configurati e da quello fornito.
 * - Nessun token configurato → "owner" (dev aperto, retro-compatibile).
 * - Match del token fornito, in ordine di precedenza owner → editor → viewer.
 * - Token configurato ma nessun match → "viewer" (può solo le route di lettura,
 *   già aperte; l'osservatore pubblico degenere).
 * Un tier con token vuoto non fa mai match (nemmeno con un provided vuoto).
 */
export function resolveRole(tokens: RoleTokens, provided: string): Role {
  const anyConfigured = Boolean(tokens.owner || tokens.editor || tokens.viewer);
  if (!anyConfigured) return "owner";
  if (provided) {
    if (tokens.owner && provided === tokens.owner) return "owner";
    if (tokens.editor && provided === tokens.editor) return "editor";
    if (tokens.viewer && provided === tokens.viewer) return "viewer";
  }
  return "viewer";
}

/** true se `role` è almeno `min` nella gerarchia viewer < editor < owner. */
export function roleAtLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}
