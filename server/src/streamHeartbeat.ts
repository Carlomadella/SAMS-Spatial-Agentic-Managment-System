// Un battito del heartbeat dello stream `/api/events`. Gira dentro `setInterval`: lì
// un'eccezione (o una promessa rifiutata) non gestita fa cadere l'intero runtime, quindi
// qui **niente può lanciare né rifiutare**.
// Ultrareview 2026-11-11: il controllo della sessione legge il DB, e un errore (es.
// SQLITE_BUSY durante un backup, o una connessione MySQL persa) usciva dal callback.

export interface HeartbeatDeps {
  /** Lo stream è già chiuso o distrutto? */
  isGone: () => boolean;
  /** La credenziale con cui è stato aperto vale ancora? Può lanciare o rifiutare (legge il DB). */
  stillAllowed: () => boolean | Promise<boolean>;
  write: (chunk: string) => void;
  end: () => void;
  cleanup: () => void;
  onCheckError: (err: unknown) => void;
}

/** Evento con nome (non un commento ":"): il client lo vede e lo usa come segno di vita. */
export const PING = "event: ping\ndata: {}\n\n";

export async function heartbeatTick(d: HeartbeatDeps): Promise<void> {
  if (d.isGone()) {
    d.cleanup();
    return;
  }
  let allowed: boolean;
  try {
    allowed = await d.stillAllowed();
  } catch (err) {
    // Non si sa se la credenziale vale ancora: si chiude **questo** stream (via chiusa).
    // Il client si ricollega da solo col backoff e ripassa dal biglietto.
    d.onCheckError(err);
    allowed = false;
  }
  // Il controllo è asincrono: lo stream può essersi chiuso nel frattempo.
  if (d.isGone()) {
    d.cleanup();
    return;
  }
  if (!allowed) {
    try {
      d.end();
    } catch {
      /* già chiuso */
    }
    d.cleanup();
    return;
  }
  try {
    d.write(PING);
  } catch {
    d.cleanup();
  }
}
