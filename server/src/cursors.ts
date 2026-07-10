// Live presence cursors (Roadmap 4, frontiera #2 — "il salto grosso": cursori
// live Figma-style). Ogni vista rimbalza la posizione del suo puntatore sul
// pavimento della stanza; le altre viste lo disegnano in scena. Effimero: si
// rimbalza sul canale SSE esistente (nessun WebSocket nuovo) e non si persiste
// mai. Qui vive solo il sanitizer puro dell'input client (non fidato); la
// guardia HTTP e il broadcast stanno in `server.ts`.

export interface LiveCursor {
  /** id stabile della vista (lo stesso `viewerId` della presence). */
  id: string;
  /** nome mostrato accanto al cursore. */
  name: string;
  /** posizione sul pavimento in coordinate mondo. */
  x: number;
  z: number;
}

/** Le coordinate mondo plausibili: la stanza è ~±14, oltre è input spazzatura. */
const COORD_LIMIT = 60;

/**
 * Valida e normalizza un cursore ricevuto dal client. Ritorna `null` per input
 * inutilizzabile (id mancante, coordinate non finite), altrimenti un cursore con
 * id/nome ritagliati e coordinate clampate a un range sano.
 */
export function sanitizeCursor(body: unknown): LiveCursor | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  const id = typeof b.id === "string" ? b.id.trim().slice(0, 64) : "";
  if (!id) return null;

  const x = Number(b.x);
  const z = Number(b.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;

  const name = (typeof b.name === "string" ? b.name.trim() : "").slice(0, 40) || "Ospite";
  const clamp = (v: number) => Math.max(-COORD_LIMIT, Math.min(COORD_LIMIT, v));
  return { id, name, x: clamp(x), z: clamp(z) };
}
