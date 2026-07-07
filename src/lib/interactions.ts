// Oggetti interagibili della stanza: micro-interazioni *dell'utente* (non degli
// agenti) quando clicca un oggetto della scena — la macchina del caffè, la
// lavagna della coda, l'orologio a muro. Qui vive solo la logica pura e testabile
// (chi/cosa/che messaggio); la scena 3D si limita a dispatchare le azioni dello
// store (feedAgent, setBottomTab, pushToast).

import type { Agent } from "../types";

export interface CoffeeBreak {
  /** Agenti che ricevono la pausa: quelli con un po' di fame da smorzare. */
  fedIds: string[];
  /** Di quanto si riduce la fame (0-100). */
  amount: number;
  /** Messaggio pronto per il toast. */
  message: string;
}

/**
 * Pausa caffè: sazia gli agenti affamati. Pura — decide *chi* nutrire, di
 * *quanto* e con *quale* messaggio; la dispatch (`feedAgent`) resta al chiamante.
 * Un agente già sazio (hunger 0) non guadagna nulla, quindi resta fuori.
 */
export function coffeeBreak(agents: Agent[], amount = 25): CoffeeBreak {
  const fedIds = agents.filter((a) => a.hunger > 0).map((a) => a.id);
  const message = fedIds.length
    ? `☕ Pausa caffè — ${fedIds.length} ${fedIds.length === 1 ? "agente ricaricato" : "agenti ricaricati"}`
    : "☕ Caffè pronto, ma sono tutti già sazi";
  return { fedIds, amount, message };
}

/**
 * Rintocco dell'orologio a muro: una frase con l'ora reale e la fase della
 * giornata in ufficio. Pura, `now` iniettabile per i test.
 */
export function officeClockChime(now: Date = new Date()): string {
  const h = now.getHours();
  const hh = String(h).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const phase =
    h < 6 ? "🌙 notte fonda" :
    h < 12 ? "🌅 mattina" :
    h < 18 ? "🏙️ pomeriggio" :
    "🌆 sera";
  return `🕰️ Sono le ${hh}:${mm} — ${phase} in ufficio`;
}
