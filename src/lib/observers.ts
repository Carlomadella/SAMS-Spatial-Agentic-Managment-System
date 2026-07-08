// Avatar degli osservatori — "ufficio multiplayer" (Roadmap 4, frontiera #2/#3),
// slice de-riscato sul canale SSE già esistente.
//
// La presence sa già *chi* sta guardando lo stesso ufficio (nomi distinti,
// deduplicati per viewerId lato server). Qui la si trasforma in una fila di
// avatar vivi — così vedi *le persone* nel workspace, non solo un numero. Nessun
// nuovo transport: i cursori live (Figma-style) richiederebbero WebSocket ed è il
// salto architetturale grosso, tenuto per ultimo. Logica pura e testabile qui; il
// rendering vive in `PresenceRoster.tsx`.

/** Una persona nella fila degli osservatori. */
export interface ObserverAvatar {
  name: string;
  /** 1–2 lettere maiuscole per l'avatar. */
  initial: string;
  /** colore esadecimale, deterministico dal nome. */
  color: string;
  /** vero per la vista corrente (tu). */
  isYou: boolean;
}

/** Palette avatar (indipendente dai colori-agente per non confondere le due cose). */
export const AVATAR_COLORS = [
  "#6366f1", // indigo
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#14b8a6", // teal
];

/** Massimo numero di avatar mostrati; oltre si mostra un "+N". */
export const MAX_AVATARS = 8;

/** Colore deterministico da un nome (hash stabile → indice nella palette). */
export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (Math.imul(h, 31) + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Iniziali da un nome: una parola → prime 2 lettere; più parole → prime di prima+ultima. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Costruisce la fila degli osservatori distinti a partire dai nomi rimbalzati
 * dalla presence e dal proprio nome. "Tu" è sempre in testa e marcato `isYou`;
 * i duplicati (per nome, case-insensitive) sono uniti; la lista è cappata a
 * `MAX_AVATARS`. Deterministico e privo di effetti collaterali.
 */
export function observerRoster(people: string[], myName: string): ObserverAvatar[] {
  const me = (myName || "Ospite").trim() || "Ospite";
  const seen = new Set<string>();
  const out: ObserverAvatar[] = [];
  for (const raw of [me, ...(Array.isArray(people) ? people : [])]) {
    const name = (typeof raw === "string" ? raw : "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      initial: initialsOf(name),
      color: avatarColor(name),
      isYou: out.length === 0, // il primo è sempre "tu" (me è in testa)
    });
    if (out.length >= MAX_AVATARS) break;
  }
  return out;
}

/** Quante persone distinte oltre quelle mostrate (per il badge "+N"). */
export function overflowCount(people: string[], myName: string): number {
  const me = (myName || "Ospite").trim() || "Ospite";
  const seen = new Set<string>([me.toLowerCase()]);
  for (const raw of Array.isArray(people) ? people : []) {
    const name = (typeof raw === "string" ? raw : "").trim();
    if (name) seen.add(name.toLowerCase());
  }
  return Math.max(0, seen.size - MAX_AVATARS);
}
