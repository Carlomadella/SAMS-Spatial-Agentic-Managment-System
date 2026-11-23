// Testo del fumetto sopra un agente nella scena 3D.
//
// Collaudo 21/11, punto 2C: un errore finiva nel fumetto per intero (fino a 90 caratteri di
// JSON del provider) e copriva la stanza. Ora un errore è un'icona e una frase breve; il
// testo completo resta nel Log eventi. Gli altri messaggi restano com'erano (max 90).

const MAX = 90;
const ERROR_MAX = 40;

export function bubbleText(text: string, level?: string): string {
  if (level === "ERROR") {
    const first = text.replace(/^Errore:\s*/i, "").split(/(?<=[.!?:])\s/)[0].replace(/[.:]$/, "");
    const short = first.length > ERROR_MAX ? `${first.slice(0, ERROR_MAX - 1)}…` : first;
    return `⚠ ${short}`;
  }
  return text.length > MAX ? `${text.slice(0, MAX - 1)}…` : text;
}
