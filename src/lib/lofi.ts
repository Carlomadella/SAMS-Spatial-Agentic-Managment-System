// La "partitura" del sottofondo lo-fi: tutto ciò che è musica e non suono. Puro e
// deterministico (niente WebAudio qui), così si può testare; `audio.ts` lo legge a ogni
// sedicesimo e genera le note.
//
// Il brano è un loop originale di 4 battute: accordi di settima in Do maggiore sulla
// progressione IV–iii–ii–I (Fmaj7 – Em7 – Dm7 – Cmaj7), basso sulla fondamentale, batteria
// leggera "boom-bap" con lo swing tipico del genere. Di notte la batteria tace e restano
// accordi e fruscio: la stanza dorme.

/** Battiti al minuto: lento, da lo-fi. */
export const LOFI_BPM = 72;
/** Sedicesimi per battuta (4/4). */
export const STEPS_PER_BAR = 16;
/** Ritardo dei sedicesimi in levare, in frazione di sedicesimo: è lo "swing". */
export const LOFI_SWING = 0.22;

/** Nota MIDI → frequenza (La4 = 69 = 440 Hz). */
export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Voicing degli accordi, in note MIDI, una battuta ciascuno. */
export const PROGRESSION: readonly (readonly number[])[] = [
  [53, 57, 60, 64], // Fmaj7: Fa La Do Mi
  [52, 55, 59, 62], // Em7:   Mi Sol Si Re
  [50, 53, 57, 60], // Dm7:   Re Fa La Do
  [48, 52, 55, 59], // Cmaj7: Do Mi Sol Si
];

/**
 * Fondamentale dell'accordo al basso: Fa2 e Mi2 (87/82 Hz), poi Re3 e Do3 (147/131 Hz)
 * invece di Re2/Do2 (73/65 Hz), che cadrebbero proprio nella zona del vecchio ronzio a
 * 72/90 Hz. Va suonato **pizzicato** (vedi `BASS_NOTE_S`): una nota bassa tenuta per tutta
 * la battuta, battuta dopo battuta, all'orecchio è un drone continuo.
 */
export const BASS: readonly number[] = [41, 40, 50, 48];
/** Durata massima di una nota di basso, in secondi: corta, così il basso pulsa e non ronza. */
export const BASS_NOTE_S = 0.45;

export type Drum = "kick" | "snare" | "hat";

const KICK = new Set([0, 7, 10]);
const SNARE = new Set([4, 12]);

/** Che colpi di batteria cadono su un sedicesimo della battuta (0–15). */
export function drumsAt(step: number): Drum[] {
  const s = ((step % STEPS_PER_BAR) + STEPS_PER_BAR) % STEPS_PER_BAR;
  const hits: Drum[] = [];
  if (KICK.has(s)) hits.push("kick");
  if (SNARE.has(s)) hits.push("snare");
  if (s % 2 === 0) hits.push("hat");
  return hits;
}

/** L'accordo e il basso della battuta `bar` (il loop riparte ogni 4). */
export function chordForBar(bar: number): { notes: readonly number[]; bass: number } {
  const i = ((bar % PROGRESSION.length) + PROGRESSION.length) % PROGRESSION.length;
  return { notes: PROGRESSION[i], bass: BASS[i] };
}

/** Durata di un sedicesimo, in secondi. */
export function stepDuration(bpm = LOFI_BPM): number {
  return 60 / bpm / 4;
}

/**
 * Quanto attendere dal sedicesimo `step` al successivo, swing compreso: i sedicesimi
 * pari si allungano e i dispari si accorciano della stessa quantità, così ogni coppia
 * dura sempre due sedicesimi e il tempo non deriva.
 */
export function stepAdvance(step: number, bpm = LOFI_BPM, swing = LOFI_SWING): number {
  const d = stepDuration(bpm);
  return step % 2 === 0 ? d * (1 + swing) : d * (1 - swing);
}

/** Sui sedicesimi in cui si suona l'accordo: attacco a inizio battuta e una ribattuta morbida. */
export function chordHitAt(step: number): "strike" | "ghost" | null {
  const s = ((step % STEPS_PER_BAR) + STEPS_PER_BAR) % STEPS_PER_BAR;
  if (s === 0) return "strike";
  if (s === 10) return "ghost";
  return null;
}
