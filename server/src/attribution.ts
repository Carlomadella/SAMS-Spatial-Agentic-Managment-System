// Attribuzione per-utente delle azioni che avviano lavoro (Roadmap 4,
// osservabilità). Ora che il workspace ha identità (nome della vista) e ruoli
// (owner/editor/viewer), il runtime può registrare *chi* ha assegnato/approvato/
// rifiutato, non solo *cosa*. Qui vivono le funzioni pure che ripuliscono il nome
// dichiarato dal client e lo compongono col ruolo in un'etichetta per il log.
//
// Il nome è dichiarato dal client (non verificato): va trattato come input non
// fidato — niente caratteri di controllo, lunghezza limitata.

import type { Role } from "./roles";

const MAX_ACTOR = 40;
// Caratteri di controllo C0 + DEL: rimossi dal nome dichiarato dal client.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\x00-\x1f\x7f]/g;

/** Ripulisce un nome-attore dichiarato dal client: rimuove i caratteri di
 *  controllo, comprime gli spazi e taglia a `MAX_ACTOR`. Ritorna "" se assente
 *  o non stringa (l'attore resta anonimo, identificato dal solo ruolo). */
export function sanitizeActor(name: unknown): string {
  if (typeof name !== "string") return "";
  return name.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, MAX_ACTOR);
}

/** Etichetta per il log strutturato: `"Marco (editor)"` con un nome, `"editor"`
 *  senza. Deterministica, sicura per input vuoto/sporco. */
export function actorLabel(role: Role, name?: unknown): string {
  const clean = sanitizeActor(name);
  return clean ? `${clean} (${role})` : role;
}
