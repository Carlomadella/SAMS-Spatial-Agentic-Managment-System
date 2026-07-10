// Presenza di selezione (Roadmap 4, frontiera #2 — consapevolezza collaborativa,
// gemella dei cursori live). Ogni vista annuncia *quale agente* ha selezionato
// (o nessuno); le altre viste lo mostrano con un'aura sull'agente. Effimero: si
// rimbalza sul canale SSE esistente e non si persiste mai. Qui vive solo il
// sanitizer puro dell'input client (non fidato); la guardia HTTP e il broadcast
// stanno in `server.ts`.

export interface RemoteSelection {
  /** id stabile della vista (lo stesso `viewerId` di presence/cursori). */
  id: string;
  /** nome mostrato accanto all'aura. */
  name: string;
  /** id dell'agente selezionato, oppure null se la vista ha deselezionato. */
  agentId: string | null;
}

/**
 * Valida e normalizza una selezione ricevuta dal client. Ritorna `null` solo per
 * input senza id (inutilizzabile); un `agentId` mancante/vuoto è legittimo e
 * significa "nessuna selezione".
 */
export function sanitizeSelection(body: unknown): RemoteSelection | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  const id = typeof b.id === "string" ? b.id.trim().slice(0, 64) : "";
  if (!id) return null;

  const name = (typeof b.name === "string" ? b.name.trim() : "").slice(0, 40) || "Ospite";
  const agentId =
    typeof b.agentId === "string" && b.agentId.trim() ? b.agentId.trim().slice(0, 64) : null;
  return { id, name, agentId };
}
