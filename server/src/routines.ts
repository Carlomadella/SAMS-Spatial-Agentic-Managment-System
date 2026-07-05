// Trigger temporali / routine — task ricorrenti guidati dal runtime ("ogni
// mattina: riepilogo PR aperte su Notion"). Uno scheduler lato server controlla
// periodicamente le routine e, quando una è "dovuta", emette un `wake` che il
// client assegna a un agente libero (riusa il percorso WakeBridge dei webhook).
//
// Logica pura e testabile qui; la persistenza vive in `db.ts` (tabella
// `routines`) e il tick + gli endpoint CRUD in `server.ts`. Due modalità di
// pianificazione, semplici e amichevoli invece di un cron completo:
//   • interval — ogni N minuti
//   • daily    — ogni giorno a un orario locale HH:MM

export type RoutineKind = "interval" | "daily";

export interface Routine {
  id: string;
  /** Etichetta mostrata all'utente, es. "Riepilogo PR". */
  name: string;
  /** Titolo del task assegnato quando la routine scatta. */
  title: string;
  /** Branch del task (vuoto = "main"). */
  branch: string;
  kind: RoutineKind;
  /** Minuti fra un'esecuzione e l'altra (usato con kind = "interval"). */
  intervalMin: number;
  /** Ora locale 0..23 (usato con kind = "daily"). */
  atHour: number;
  /** Minuti 0..59 (usato con kind = "daily"). */
  atMin: number;
  enabled: boolean;
  /** epoch ms dell'ultima esecuzione (0 = mai). */
  lastRun: number;
}

/** Campi accettati dall'API per creare una routine (senza id/lastRun). */
export type RoutineInput = Omit<Routine, "id" | "lastRun">;

function clampInt(n: unknown, lo: number, hi: number, fallback: number): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Normalizza e valida l'input grezzo di una routine. Ritorna `null` se mancano
 * i campi essenziali (nome + titolo). Gli orari/intervalli fuori range vengono
 * riportati nei limiti; un `kind` sconosciuto diventa "interval".
 */
export function sanitizeRoutine(raw: Partial<RoutineInput> | undefined): RoutineInput | null {
  if (!raw) return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!name || !title) return null;
  const kind: RoutineKind = raw.kind === "daily" ? "daily" : "interval";
  return {
    name: name.slice(0, 80),
    title: title.slice(0, 200),
    branch: typeof raw.branch === "string" ? raw.branch.trim().slice(0, 120) : "",
    kind,
    intervalMin: clampInt(raw.intervalMin, 1, 60 * 24 * 7, 60),
    atHour: clampInt(raw.atHour, 0, 23, 9),
    atMin: clampInt(raw.atMin, 0, 59, 0),
    enabled: raw.enabled !== false,
  };
}

/** epoch ms dell'orario pianificato (HH:MM locale) nel giorno che contiene `now`. */
export function dailyScheduledMs(now: number, atHour: number, atMin: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), atHour, atMin, 0, 0).getTime();
}

/**
 * La routine deve scattare adesso? Deve essere abilitata e:
 *   • interval — è passato almeno `intervalMin` dall'ultima esecuzione (o non è
 *     mai stata eseguita);
 *   • daily — `now` ha superato l'orario odierno e non è ancora stata eseguita
 *     dopo quell'orario (una sola volta al giorno).
 */
export function isDue(r: Routine, now: number): boolean {
  if (!r.enabled) return false;
  if (r.kind === "interval") {
    const ms = Math.max(1, r.intervalMin) * 60_000;
    return r.lastRun === 0 ? true : now - r.lastRun >= ms;
  }
  const scheduled = dailyScheduledMs(now, r.atHour, r.atMin);
  return now >= scheduled && r.lastRun < scheduled;
}

/** Prossima esecuzione prevista (epoch ms), per la UI. */
export function nextRun(r: Routine, now: number): number {
  if (r.kind === "interval") {
    const ms = Math.max(1, r.intervalMin) * 60_000;
    return (r.lastRun || now) + ms;
  }
  const today = dailyScheduledMs(now, r.atHour, r.atMin);
  return now < today ? today : today + 24 * 60 * 60_000;
}

/** Tutte le routine dovute adesso. */
export function dueRoutines(routines: Routine[], now: number): Routine[] {
  return routines.filter((r) => isDue(r, now));
}

/** Descrizione umana della pianificazione, es. "ogni 60 min" o "ogni giorno alle 09:00". */
export function describeSchedule(r: Pick<Routine, "kind" | "intervalMin" | "atHour" | "atMin">): string {
  if (r.kind === "interval") return `ogni ${Math.max(1, r.intervalMin)} min`;
  const hh = String(r.atHour).padStart(2, "0");
  const mm = String(r.atMin).padStart(2, "0");
  return `ogni giorno alle ${hh}:${mm}`;
}
