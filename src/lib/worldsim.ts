// Movimento condiviso (Roadmap 4, opzione B3). Il driver spinge le posizioni live
// degli agenti; qui vive lo stato effimero ricevuto dalle altre viste (posizione +
// waypoint corrente) più i puri helper condivisi da store e scena. Gemello dei
// cursori: lossy, mai persistito, ripulito dalla staleness quando il driver sparisce.

export interface SimAgent {
  x: number;
  z: number;
  tx: number | null;
  tz: number | null;
  /** bisogni adottati dal driver (0–100); assenti se il driver non li spinge. */
  energy?: number;
  hunger?: number;
  /** ora di ricezione lato client, per la staleness. */
  ts: number;
}

/** Quanto vive uno stato cinematico dopo l'ultimo update prima di scadere (ms). */
export const SIM_TTL = 5000;

/**
 * Scarta gli stati più vecchi di `ttl`. Ritorna lo STESSO oggetto quando nulla
 * cambia, così il chiamante può saltare un update di stato (e un re-render) inutile.
 */
export function pruneSim(
  sim: Record<string, SimAgent>,
  now: number,
  ttl = SIM_TTL,
): Record<string, SimAgent> {
  let changed = false;
  const kept: Record<string, SimAgent> = {};
  for (const [id, s] of Object.entries(sim)) {
    if (now - s.ts <= ttl) kept[id] = s;
    else changed = true;
  }
  return changed ? kept : sim;
}

/**
 * Costruisce la mappa id→SimAgent da uno snapshot cinematico in arrivo, timbrando
 * il tempo di ricezione (`ts`) per la staleness. Il driver spinge il roster intero
 * a ogni tick, quindi lo snapshot **sostituisce** lo stato precedente (un agente
 * scomparso dallo snapshot semplicemente non c'è più). Scarta le voci senza id.
 */
export function ingestSim(
  agents: {
    id: string;
    x: number;
    z: number;
    tx: number | null;
    tz: number | null;
    energy?: number;
    hunger?: number;
  }[],
  now: number,
): Record<string, SimAgent> {
  const map: Record<string, SimAgent> = {};
  for (const a of agents) {
    if (!a || typeof a.id !== "string" || !a.id) continue;
    map[a.id] = { x: a.x, z: a.z, tx: a.tx, tz: a.tz, energy: a.energy, hunger: a.hunger, ts: now };
  }
  return map;
}

/**
 * Questa vista è il simulatore (driver o solitaria)? Vero se nessuno tiene il lease
 * o se lo tiene questa vista; falso se un'ALTRA vista guida — in quel caso siamo
 * follower e adottiamo il suo mondo animato read-only invece di simulare per conto
 * nostro. Default (nessun driver ancora eletto) → simuliamo, così una vista da sola
 * si comporta esattamente come prima.
 */
export function iAmSimulator(driver: { holderId: string } | null, selfId: string): boolean {
  return !driver || driver.holderId === selfId;
}

/**
 * Posizioni live degli agenti (mesh), scritte ogni frame da `Agent3D` e lette dal
 * `WorldSimBridge` del driver per spingerle. Non passa dallo store: la posizione
 * interpolata del cammino vive nel ref della mesh (lo store committa solo all'arrivo),
 * quindi serve un canale diretto e senza re-render per condividere il movimento fluido.
 */
export const liveAgentPositions = new Map<string, [number, number]>();
