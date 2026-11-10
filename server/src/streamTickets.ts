import { randomBytes } from "node:crypto";

// Biglietti per lo stream eventi (`/api/events`) — decisione D4-C della 1.0.
//
// Con i ruoli attivi lo stream non deve essere leggibile da un anonimo. Ma un
// EventSource è sempre una GET senza header: il token di sessione non può viaggiare
// in `Authorization`, e metterlo nell'URL lo lascerebbe valido nei log di un proxy.
// Quindi il client, autenticato, chiede un **biglietto** (`POST /api/events/ticket`)
// e lo mette nell'URL: vale una volta sola e per pochi secondi, così un URL finito in
// un log non serve più a niente.

export const STREAM_TICKET_TTL_MS = 30_000;
const MAX_TICKETS = 5_000;

export class StreamTickets {
  /** biglietto → scadenza (ms). La Map tiene l'ordine di inserimento: i primi sono i più vecchi. */
  private readonly tickets = new Map<string, number>();

  constructor(
    private readonly ttlMs: number = STREAM_TICKET_TTL_MS,
    private readonly now: () => number = Date.now,
    private readonly max: number = MAX_TICKETS,
  ) {}

  /** Quanti biglietti sono in memoria (per i test). */
  get size(): number {
    return this.tickets.size;
  }

  /** Emette un biglietto nuovo (32 byte casuali, in esadecimale). */
  issue(): string {
    this.prune();
    while (this.tickets.size >= this.max) {
      const oldest = this.tickets.keys().next().value as string;
      this.tickets.delete(oldest);
    }
    const ticket = randomBytes(32).toString("hex");
    this.tickets.set(ticket, this.now() + this.ttlMs);
    return ticket;
  }

  /** Consuma il biglietto: true una sola volta, se esiste e non è scaduto. */
  consume(ticket: unknown): boolean {
    if (typeof ticket !== "string" || !ticket) return false;
    const expires = this.tickets.get(ticket);
    if (expires === undefined) return false;
    this.tickets.delete(ticket);
    return this.now() < expires;
  }

  private prune(): void {
    const now = this.now();
    for (const [t, exp] of this.tickets) if (exp <= now) this.tickets.delete(t);
  }
}
