// Rate-limit a finestra scorrevole — igiene per gli endpoint scrivibili di un
// workspace condiviso (Roadmap 4). Logica pura e testabile: `now` è iniettabile,
// così i test non dipendono dall'orologio. Prima applicazione: la chat, per
// evitare che una vista sature il canale (flood). Riutilizzabile altrove.

export interface RateLimiter {
  /** Registra un tentativo per `key`; `true` se dentro il limite, `false` se oltre. */
  hit(key: string, now?: number): boolean;
  /** Ms da attendere prima che `key` possa ritentare (0 se è già consentito). */
  retryAfterMs(key: string, now?: number): number;
}

/**
 * Consente al più `max` eventi per `key` in ogni finestra di `windowMs`. Tiene i
 * timestamp recenti per chiave e scarta quelli usciti dalla finestra a ogni
 * chiamata, così la memoria per chiave resta limitata a `max`.
 */
export function createRateLimiter(max: number, windowMs: number): RateLimiter {
  const hits = new Map<string, number[]>();

  const recent = (key: string, now: number): number[] => {
    const cutoff = now - windowMs;
    const kept = (hits.get(key) ?? []).filter((t) => t > cutoff);
    if (kept.length > 0) hits.set(key, kept);
    else hits.delete(key);
    return kept;
  };

  return {
    hit(key, now = Date.now()) {
      const kept = recent(key, now);
      if (kept.length >= max) return false;
      hits.set(key, [...kept, now]);
      return true;
    },
    retryAfterMs(key, now = Date.now()) {
      const kept = recent(key, now);
      if (kept.length < max) return 0;
      const oldest = kept[0];
      return Math.max(0, windowMs - (now - oldest));
    },
  };
}
