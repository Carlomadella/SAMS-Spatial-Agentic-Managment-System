// Indicatore del motore AI nella barra in basso (collaudo 21/11, punto 2B).

export interface EngineStatus {
  provider: string;
  mode: "ok" | "fallback" | "exhausted";
  /** epoch ms del cambio di stato */
  since: number;
}

function hhmm(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Testo breve, tono e spiegazione per la barra. */
export function engineLabel(e: EngineStatus): { text: string; tone: "ok" | "warn" | "bad"; title: string } {
  if (e.mode === "exhausted") {
    return {
      text: "Motore: quote finite",
      tone: "bad",
      title: `Le quote gratuite dei modelli sono finite (dalle ${hhmm(e.since)}). I task falliranno finché non si ricaricano o finché non aggiungi una chiave di riserva in ⚙ Motore AI.`,
    };
  }
  if (e.mode === "fallback") {
    return {
      text: `Motore: ${e.provider} (riserva)`,
      tone: "warn",
      title: `Il motore principale non risponde o ha finito la quota: dalle ${hhmm(e.since)} risponde ${e.provider}, il provider di riserva.`,
    };
  }
  return { text: `Motore: ${e.provider}`, tone: "ok", title: `Il motore principale (${e.provider}) risponde.` };
}
