// Disposizione del "mini bosco" attorno alla pianta principale del Commit
// Garden: gli alberi dei contributor (leaderboard) + qualche albero d'ambiente
// vengono sparsi su anelli concentrici, lasciando aperto un cono frontale verso
// la camera così la pianta centrale e il vialetto restano visibili. Puro e
// deterministico (stessa disposizione a ogni render) → testabile senza la scena.

export interface ForestSlot {
  x: number;
  z: number;
  /** fattore di scala dell'albero (più piccolo verso l'esterno) */
  scale: number;
}

/** RNG deterministico 0..1 da un indice + un "sale" (hash sinusoidale). */
function rand(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Il cono frontale (in gradi) lasciato libero verso la camera (+z). */
export const FRONT_GAP: [number, number] = [50, 130];

/**
 * Dispone `n` alberi su anelli concentrici. Gli angoli spaziano da 130° a 410°
 * (= 50°), evitando il cono frontale 50°–130° (centrato su +z). Gli anelli più
 * esterni sono più lontani e leggermente più piccoli, per dare profondità.
 */
export function forestSlots(n: number, perRing = 6): ForestSlot[] {
  const slots: ForestSlot[] = [];
  for (let i = 0; i < n; i++) {
    const ring = Math.floor(i / perRing);
    const t = n > 1 ? (i + 0.5) / n : 0.5;
    const angDeg = 130 + t * 280; // 130°..410°, salta il cono frontale
    const a = (angDeg * Math.PI) / 180;
    const r = 5.5 + ring * 2.4 + rand(i, 1) * 1.1;
    slots.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      scale: Math.max(0.4, 0.85 + rand(i, 2) * 0.4 - ring * 0.12),
    });
  }
  return slots;
}
