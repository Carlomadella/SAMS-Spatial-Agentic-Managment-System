import { randomBytes } from "node:crypto";

// Biglietti per lo stream eventi (`/api/events`) — decisione D4-C della 1.0.
//
// Con i ruoli attivi lo stream non deve essere leggibile da un anonimo. Ma un
// EventSource è sempre una GET senza header: il token di sessione non può viaggiare
// in `Authorization`, e metterlo nell'URL lo lascerebbe valido nei log di un proxy.
// Quindi il client, autenticato, chiede un **biglietto** (`POST /api/events/ticket`)
// e lo mette nell'URL: vale una volta sola e per pochi secondi, così un URL finito in
// un log non serve più a niente.
//
// Il biglietto ricorda la **credenziale** che l'ha chiesto (token di sessione o token
// statico): il server la ricontrolla per tutta la vita dello stream, così un logout o
// una sessione revocata chiudono anche lo stream già aperto.
//
// Contro chi ne chiede a raffica: un tetto per credenziale (oltre, cadono i suoi più
// vecchi) e un tetto globale che **rifiuta** il nuovo biglietto invece di scartare
// quelli degli altri.

export const STREAM_TICKET_TTL_MS = 30_000;

interface Ticket {
  credential: string;
  expires: number;
}

export interface StreamTicketsOptions {
  ttlMs?: number;
  now?: () => number;
  /** biglietti in sospeso in tutto */
  max?: number;
  /** biglietti in sospeso per credenziale */
  perCredential?: number;
}

export class StreamTickets {
  /** La Map tiene l'ordine di inserimento: i primi sono i più vecchi. */
  private readonly tickets = new Map<string, Ticket>();
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly max: number;
  private readonly perCredential: number;

  constructor(opts: StreamTicketsOptions = {}) {
    this.ttlMs = opts.ttlMs ?? STREAM_TICKET_TTL_MS;
    this.now = opts.now ?? Date.now;
    this.max = opts.max ?? 5_000;
    this.perCredential = opts.perCredential ?? 10;
  }

  /** Quanti biglietti sono in memoria (per i test). */
  get size(): number {
    return this.tickets.size;
  }

  /**
   * Emette un biglietto per questa credenziale ("" in dev aperto). `null` se il
   * registro è pieno: meglio un 503 a chi chiede che togliere il biglietto a un altro.
   */
  issue(credential: string): string | null {
    this.prune();
    const mine = [...this.tickets].filter(([, t]) => t.credential === credential);
    for (let i = 0; i <= mine.length - this.perCredential; i++) this.tickets.delete(mine[i][0]);
    if (this.tickets.size >= this.max) return null;
    const ticket = randomBytes(32).toString("hex");
    this.tickets.set(ticket, { credential, expires: this.now() + this.ttlMs });
    return ticket;
  }

  /** Consuma il biglietto: la credenziale una sola volta, se esiste e non è scaduto; altrimenti null. */
  consume(ticket: unknown): string | null {
    if (typeof ticket !== "string" || !ticket) return null;
    const t = this.tickets.get(ticket);
    if (!t) return null;
    this.tickets.delete(ticket);
    return this.now() < t.expires ? t.credential : null;
  }

  private prune(): void {
    const now = this.now();
    for (const [k, t] of this.tickets) if (t.expires <= now) this.tickets.delete(k);
  }
}
