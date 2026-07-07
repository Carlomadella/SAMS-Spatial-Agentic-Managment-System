// Notifiche desktop (opt-in) — quando la scheda di SAMS è in secondo piano, gli
// eventi *ad alto segnale* meritano un avviso del sistema operativo, non solo una
// riga nel log. Qui vive solo la **decisione** (pura e testabile): quali eventi
// notificare e come formattarli. Il wiring (permesso, `document.hidden`, l'oggetto
// `Notification`) sta in un bridge lato App, dietro a un flag persistito.

import type { LogLevel } from "../types";

export interface NotifiableEvent {
  level: LogLevel;
  message: string;
  agentName?: string;
}

// Parole-chiave che segnalano un evento che richiede attenzione dell'utente anche
// quando non è un SUCCESS/ERROR (tipicamente un WARN "N file pronti — approva…").
const ATTENTION_HINTS = ["approv", "pronti", "bloccat", "blocked", "rifiut"];

/**
 * Vale la pena di una notifica desktop? Sì per i due estremi — un lavoro concluso
 * (`SUCCESS`) o un errore (`ERROR`) — e per i `WARN` che chiedono un'azione
 * (approvazione/blocco). Gli `INFO` e gli `IDLE` restano rumore di fondo del log.
 */
export function shouldNotify(ev: Pick<NotifiableEvent, "level" | "message">): boolean {
  if (ev.level === "SUCCESS" || ev.level === "ERROR") return true;
  if (ev.level === "WARN") {
    const m = ev.message.toLowerCase();
    return ATTENTION_HINTS.some((h) => m.includes(h));
  }
  return false;
}

/** Titolo della notifica: il nome dell'agente se c'è, altrimenti "SAMS". */
export function notificationTitle(ev: Pick<NotifiableEvent, "agentName">): string {
  return ev.agentName?.trim() || "SAMS";
}

/** Corpo della notifica: il messaggio ripulito, troncato a una lunghezza sana. */
export function notificationBody(ev: Pick<NotifiableEvent, "message">, cap = 140): string {
  const m = ev.message.trim();
  return m.length > cap ? `${m.slice(0, cap - 1).trimEnd()}…` : m;
}
