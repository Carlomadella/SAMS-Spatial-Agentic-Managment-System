// Presence con identità — "mondo condiviso" (Roadmap 4, frontiera #2), secondo
// slice. Il primo slice rimbalzava solo *quante* viste guardano; qui aggiungiamo
// *chi*: ogni vista si presenta con un id stabile e un nome.
//
// L'identità arriva dal client in due modi (canale bidirezionale, primo pezzo
// concreto della frontiera #1):
//   1. al connect, come query param dell'EventSource (`/api/events?v=…&n=…`);
//   2. a caldo, via `POST /api/presence`, per rinominarsi senza riconnettersi.
//
// Logica pura e testabile qui; lo stato delle connessioni e gli endpoint vivono
// in `server.ts`. Il conteggio delle viste resta per-connessione (due schede =
// due viste), ma i *nomi* si deduplicano per id, così una persona con più schede
// compare una volta sola.

export interface Observer {
  /** Id stabile della vista (persistito dal client). Vuoto = anonimo. */
  id: string;
  /** Nome visualizzato, già ripulito. */
  name: string;
}

const MAX_ID = 64;
const MAX_NAME = 40;
export const DEFAULT_OBSERVER_NAME = "Ospite";

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max).trim() : "");

/**
 * Normalizza l'identità dichiarata da una vista: id ripulito (vuoto = anonimo) e
 * nome con trim + clamp e fallback a "Ospite". Non inventa mai un id: un id vuoto
 * resta vuoto, e ogni vista anonima conta come persona a sé (non deducibile).
 */
export function sanitizeObserverIdentity(rawId: unknown, rawName: unknown): Observer {
  return {
    id: str(rawId, MAX_ID),
    name: str(rawName, MAX_NAME) || DEFAULT_OBSERVER_NAME,
  };
}

/**
 * Elenco dei nomi *distinti* che stanno guardando, ordinato in modo stabile
 * (case-insensitive). Deduplica per id (prima occorrenza vince); le viste
 * anonime (id vuoto) non si possono deduplicare, quindi contano ciascuna.
 */
export function distinctPeople(observers: Iterable<Observer>): string[] {
  const byId = new Map<string, string>(); // id → primo nome visto
  const anon: string[] = [];
  for (const o of observers) {
    if (o.id) {
      if (!byId.has(o.id)) byId.set(o.id, o.name);
    } else {
      anon.push(o.name);
    }
  }
  return [...byId.values(), ...anon].sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));
}

/**
 * Payload di presence rimbalzato via SSE. `views` è il conteggio delle
 * connessioni (retro-compat: il client vecchio legge `presence`), `people` sono i
 * nomi distinti. Tenuto puro così il broadcast lato server è una riga sola.
 */
export function presenceState(observers: Observer[]): { views: number; people: string[] } {
  return { views: observers.length, people: distinctPeople(observers) };
}
