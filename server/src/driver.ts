// Driver lease (Roadmap 4, frontiera #1/#2 — opzione B3, "mondo animato condiviso").
//
// Con più viste, se ognuna simula il proprio mondo in modo indipendente non c'è
// una verità sola sul movimento. B3 elegge UNA vista "driver" che simula, mentre
// le altre seguono. Questo è il *primo mattone*: la sola elezione a titolo unico
// (lease rinnovabile che scade). NON sposta ancora il game loop — stabilisce solo
// il coordinamento, quindi non tocca la simulazione esistente. Logica pura e
// testabile; lo stato e il broadcast SSE stanno in `server.ts`.

export interface DriverLease {
  /** id della vista che tiene il lease (lo stesso `viewerId` di presence). */
  holderId: string;
  /** nome del titolare, per mostrarlo nelle altre viste. */
  name: string;
  /** epoch ms in cui il lease scade se non rinnovato. */
  expiresAt: number;
}

/** Durata di un lease driver: va rinnovato entro questo tempo o decade. */
export const DRIVER_TTL = 5000;

/** true se esiste un lease ancora valido (non scaduto) al momento `now`. */
export function isLeaseValid(lease: DriverLease | null, now: number): boolean {
  return !!lease && lease.expiresAt > now;
}

/**
 * Rivendica o rinnova il lease driver.
 * - Nessun titolare valido → il richiedente diventa driver (`changed: true`).
 * - Il richiedente è già il titolare → rinnovo (scadenza estesa; `changed` solo
 *   se il nome è cambiato, così un rename si propaga).
 * - Un altro tiene un lease valido → invariato (`changed: false`).
 * `changed` indica se l'*identità/nome* del driver è cambiata → se va ribroadcastato.
 */
export function claimDriver(
  current: DriverLease | null,
  id: string,
  name: string,
  now: number,
  ttl = DRIVER_TTL,
): { lease: DriverLease; changed: boolean } {
  if (!isLeaseValid(current, now)) {
    return { lease: { holderId: id, name, expiresAt: now + ttl }, changed: true };
  }
  if (current!.holderId === id) {
    return { lease: { holderId: id, name, expiresAt: now + ttl }, changed: current!.name !== name };
  }
  return { lease: current!, changed: false };
}

/** Rilascia il lease se `id` è il titolare corrente; altrimenti lo lascia intatto. */
export function releaseDriver(current: DriverLease | null, id: string): DriverLease | null {
  return current && current.holderId === id ? null : current;
}
