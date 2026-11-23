// Pulizia una tantum degli XP inventati (collaudo 21/11, punto 5; opzione A).
//
// Fino al commit 7116858 i sei agenti di partenza nascevano con XP finti (80, 170, 40, 320,
// 600, 10) e quindi con le stelle. Il codice li ha tolti, ma il mondo già salvato sul server
// (TiDB) li teneva. Si azzerano solo i sei agenti di partenza che hanno ESATTAMENTE quel
// valore: chi ha guadagnato XP veri (si guadagnano a passi di 30) non viene toccato.
// Copia identica di server/src/fakeSeedXp.ts, per la migrazione v3 dello store nel browser:
// senza, la pagina riscriverebbe sul server gli XP finti tenuti in localStorage.

export const FAKE_SEED_XP: Readonly<Record<string, number>> = {
  "agent-blue": 80,
  "agent-green": 170,
  "agent-orange": 40,
  "agent-purple": 320,
  "agent-yellow": 600,
  "agent-red": 10,
};

/** Restituisce gli agenti con gli XP finti azzerati e quanti ne ha cambiati. */
export function dropFakeSeedXp<T extends { id: string; xp?: number }>(agents: T[]): { agents: T[]; changed: number } {
  let changed = 0;
  const out = agents.map((a) => {
    if (FAKE_SEED_XP[a.id] !== undefined && a.xp === FAKE_SEED_XP[a.id]) {
      changed++;
      return { ...a, xp: 0 };
    }
    return a;
  });
  return { agents: out, changed };
}
