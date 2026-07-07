// Personalizzazione dell'ufficio: temi cromatici della *stanza* (pareti, zoccolo,
// modanature, base della pedana). Puro e testabile — la scena 3D si limita a
// leggere i colori del tema selezionato invece delle costanti hardcoded. Il tema
// "warm" riproduce l'aspetto originale, così il default non cambia nulla a vista.

export interface RoomTheme {
  id: string;
  /** Nome mostrato nel selettore. */
  name: string;
  emoji: string;
  /** Pareti (facce principali). */
  wall: string;
  /** Boiserie (terzo inferiore delle pareti). */
  wallLower: string;
  /** Base della pedana/diorama (bordo rialzato). */
  floor: string;
  /** Modanature (chair rail + crown). */
  trim: string;
  /** Battiscopa. */
  baseboard: string;
}

export const ROOM_THEMES: RoomTheme[] = [
  { id: "warm",  name: "Sabbia calda", emoji: "🏜️", wall: "#efe7da", wallLower: "#e4d8c4", floor: "#caa877", trim: "#f5eee1", baseboard: "#dccbb0" },
  { id: "cool",  name: "Azzurro freddo", emoji: "🧊", wall: "#e6e9ef", wallLower: "#d4dae4", floor: "#9fb0c4", trim: "#eef1f6", baseboard: "#c3ccda" },
  { id: "sage",  name: "Verde salvia", emoji: "🌿", wall: "#e8ede2", wallLower: "#d5decb", floor: "#a8b98f", trim: "#f0f4ea", baseboard: "#cdd8be" },
  { id: "blush", name: "Rosa cipria", emoji: "🌸", wall: "#f2e7e7", wallLower: "#e6d3d5", floor: "#c8a0a4", trim: "#f8eeee", baseboard: "#ddc4c7" },
  { id: "mono",  name: "Grigio neutro", emoji: "🪨", wall: "#e8e8ea", wallLower: "#d6d6d9", floor: "#a6a6ab", trim: "#f1f1f3", baseboard: "#c9c9ce" },
];

/** Id del tema di default: riproduce l'aspetto storico della stanza. */
export const DEFAULT_ROOM_THEME = "warm";

/** Tema della stanza per id; ricade sul default se l'id è sconosciuto. */
export function getRoomTheme(id: string | undefined): RoomTheme {
  return ROOM_THEMES.find((t) => t.id === id) ?? ROOM_THEMES.find((t) => t.id === DEFAULT_ROOM_THEME)!;
}
