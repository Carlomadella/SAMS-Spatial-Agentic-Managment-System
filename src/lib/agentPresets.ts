import type { AgentTemplate } from "./agentTemplates";

// Preset ruolo/modello *salvati dall'utente*: profili (ruolo + modello +
// istruzioni) esportati dalla configurazione di un agente e persistiti nello
// store, applicabili in un click. Si appoggia al marketplace di template
// (`agentTemplates.ts`): un preset È un `AgentTemplate`, qui viviamo solo la
// gestione della lista (aggiunta/dedup/cap/rimozione). Logica pura e testabile.

/** Quanti preset personali teniamo al massimo (i più recenti in testa). */
export const MAX_PRESETS = 12;

const key = (name: string) => name.trim().toLowerCase();

/**
 * Aggiunge un preset in testa alla lista. Se esiste già un preset con lo stesso
 * nome (case-insensitive, trimmato) lo **sostituisce** (niente doppioni), poi
 * cappa la lista a `MAX_PRESETS`. Pura: restituisce una nuova lista.
 */
export function addPreset(list: AgentTemplate[], preset: AgentTemplate): AgentTemplate[] {
  const k = key(preset.name);
  const without = list.filter((p) => key(p.name) !== k);
  return [preset, ...without].slice(0, MAX_PRESETS);
}

/** Rimuove il preset con l'id indicato. Pura. */
export function removePreset(list: AgentTemplate[], id: string): AgentTemplate[] {
  return list.filter((p) => p.id !== id);
}
