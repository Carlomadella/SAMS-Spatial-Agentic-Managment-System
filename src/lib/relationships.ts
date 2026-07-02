// Relazioni fra agenti — la collaborazione ripetuta (handoff di `relay_task` e
// chiacchiere) costruisce affinità fra coppie di agenti. Gli "amici" si cercano
// più spesso (bias nella socializzazione) e la loro relazione si vede
// nell'inspector. Tutto puro e testabile; lo store tiene la `AffinityMap` e la
// persiste, i bridge in App la incrementano sugli eventi di collaborazione.

/** Affinità per coppia di agenti, chiave = `pairKey(a, b)`. */
export type AffinityMap = Record<string, number>;

/** Chiave ordine-indipendente per una coppia di agenti. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Incrementa (immutabilmente) l'affinità di una coppia. Ignora la self-coppia. */
export function bumpAffinity(map: AffinityMap, a: string, b: string, delta = 1): AffinityMap {
  if (!a || !b || a === b) return map;
  const k = pairKey(a, b);
  return { ...map, [k]: (map[k] ?? 0) + delta };
}

/** Affinità corrente fra due agenti (0 se mai collaborato o stessa persona). */
export function affinityBetween(map: AffinityMap, a: string, b: string): number {
  if (a === b) return 0;
  return map[pairKey(a, b)] ?? 0;
}

interface Tier { label: string; min: number }
// Dalla più forte alla più debole; sotto la soglia minima → "sconosciuti".
const TIERS: Tier[] = [
  { label: "inseparabili", min: 12 },
  { label: "amici", min: 6 },
  { label: "colleghi", min: 2 },
  { label: "conoscenti", min: 1 },
];

/** Etichetta del legame in base al punteggio di affinità. */
export function affinityTier(score: number): string {
  for (const t of TIERS) if (score >= t.min) return t.label;
  return "sconosciuti";
}

/** Il "miglior amico" di `id` fra `others`: massima affinità > 0, o null. */
export function bestFriend(
  map: AffinityMap,
  id: string,
  others: string[],
): { id: string; score: number } | null {
  let best: { id: string; score: number } | null = null;
  for (const o of others) {
    if (o === id) continue;
    const s = affinityBetween(map, id, o);
    if (s > 0 && (!best || s > best.score)) best = { id: o, score: s };
  }
  return best;
}

/** Le coppie con più affinità, dalla più forte (per una eventuale vista). */
export function topPairs(map: AffinityMap, limit = 5): { a: string; b: string; score: number }[] {
  return Object.entries(map)
    .map(([k, score]) => {
      const [a, b] = k.split("|");
      return { a, b, score };
    })
    .sort((x, y) => y.score - x.score || pairKey(x.a, x.b).localeCompare(pairKey(y.a, y.b)))
    .slice(0, limit);
}
