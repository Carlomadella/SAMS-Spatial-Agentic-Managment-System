// Chat di workspace — helper client puri (Roadmap 4, frontiera #2).
//
// La chat vive sul server e arriva via SSE (vedi `ChatPanel`/store). Qui sta solo
// la logica pura e testabile del badge "non letti": quali messaggi contano come
// non letti dal punto di vista di questa vista.

/**
 * Vero quando un messaggio in arrivo va contato come "non letto": non è mio e il
 * pannello chat non è quello attivo in questo momento. I miei stessi messaggi
 * (che rimbalzano dal server) non si contano mai.
 */
export function countsAsUnread(msgAuthor: string, myName: string, chatActive: boolean): boolean {
  if (chatActive) return false;
  const mine = msgAuthor.trim().toLowerCase() === (myName.trim() || "Ospite").toLowerCase();
  return !mine;
}

/** Testo compatto per il badge non letti (con cap a "9+"). */
export function unreadBadge(n: number): string {
  if (n <= 0) return "";
  return n > 9 ? "9+" : String(n);
}
