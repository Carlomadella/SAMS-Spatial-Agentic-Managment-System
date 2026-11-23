import type { AgentStatus } from "../types";
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

/**
 * Fumetto per un cambio di stato (23/11: un fumetto a ogni passo era troppo). Si apre
 * solo nei momenti che contano: inizio del lavoro, attesa di approvazione, blocco e fine.
 * Il resto (file letti, strumenti usati…) resta nel Log eventi.
 */
export function statusBubble(
  prev: AgentStatus,
  next: AgentStatus,
  ctx: { task?: string | null; error?: string },
): string | null {
  if (prev === next) return null;
  switch (next) {
    case "working":
      return ctx.task ? bubbleText(`▶ ${ctx.task}`) : "▶ Al lavoro";
    case "awaiting_approval":
      return "⏸ Aspetto la tua approvazione";
    case "blocked":
      return ctx.error ? bubbleText(ctx.error, "ERROR") : "⚠ Bloccato";
    case "done":
    case "review":
      return "✓ Fatto";
    default:
      return null;
  }
}
