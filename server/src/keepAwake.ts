// Il servizio resta sveglio finché un agente lavora (simulazione del 23/11).
//
// Render (piano gratuito) addormenta il servizio dopo ~15 minuti senza richieste HTTP
// nuove; uno stream SSE già aperto non conta. Due volte in mezz'ora un task di
// Sim-Revisore è stato ucciso così, senza traccia: nessuno guardava la pagina (che
// altrimenti interroga il server ogni ~20 s). Chi assegna un task lungo e chiude la scheda
// lo perderebbe allo stesso modo.
//
// Finché c'è almeno un task in corso il server chiama il proprio indirizzo pubblico
// (/api/health) ogni 10 minuti; senza task si ferma, così a riposo il servizio dorme
// come prima e non consuma ore gratuite. Attivo solo se c'è un indirizzo pubblico:
// RENDER_EXTERNAL_URL (lo imposta Render) o SAMS_KEEP_AWAKE_URL.

export const KEEP_AWAKE_EVERY_MS = 10 * 60 * 1000;

export function keepAwakeUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const base = (env.SAMS_KEEP_AWAKE_URL || env.RENDER_EXTERNAL_URL || "").trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(base) ? `${base}/api/health` : null;
}

export interface KeepAwakeDeps {
  url: string | null;
  ping: (url: string) => Promise<unknown>;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (h: unknown) => void;
}

/** Accende o spegne il ping in base a quanti task sono in corso. */
export function createKeepAwake(deps: KeepAwakeDeps): { update: (running: number) => void; active: () => boolean } {
  let handle: unknown = null;
  return {
    update(running: number) {
      if (!deps.url) return;
      if (running > 0 && handle === null) {
        const url = deps.url;
        handle = deps.setInterval(() => {
          void deps.ping(url).catch(() => { /* un ping perso non è un problema: riprova al prossimo giro */ });
        }, KEEP_AWAKE_EVERY_MS);
      } else if (running === 0 && handle !== null) {
        deps.clearInterval(handle);
        handle = null;
      }
    },
    active: () => handle !== null,
  };
}
