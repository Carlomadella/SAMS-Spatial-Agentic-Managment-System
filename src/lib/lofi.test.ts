import { describe, expect, it } from "vitest";
import {
  BASS,
  BASS_NOTE_S,
  chordForBar,
  chordHitAt,
  drumsAt,
  LOFI_BPM,
  midiToHz,
  PROGRESSION,
  stepAdvance,
  stepDuration,
  STEPS_PER_BAR,
} from "./lofi";

describe("lofi — partitura", () => {
  it("midiToHz rispetta il La a 440 e le ottave", () => {
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(midiToHz(57)).toBeCloseTo(220);
    expect(midiToHz(60)).toBeCloseTo(261.63, 1);
  });

  it("il loop è di 4 battute e riparte", () => {
    expect(PROGRESSION).toHaveLength(4);
    expect(BASS).toHaveLength(4);
    expect(chordForBar(4)).toEqual(chordForBar(0));
    expect(chordForBar(-1)).toEqual(chordForBar(3)); // robusto a indici negativi
  });

  it("il basso è la fondamentale dell'accordo, mai sopra di essa", () => {
    for (let bar = 0; bar < 4; bar++) {
      const { notes, bass } = chordForBar(bar);
      expect((notes[0] - bass) % 12).toBe(0); // stessa nota
      expect(bass).toBeLessThanOrEqual(notes[0]);
    }
  });

  it("il basso non può diventare un ronzio: sopra gli 80 Hz e pizzicato", () => {
    for (const n of BASS) expect(midiToHz(n)).toBeGreaterThan(80);
    expect(BASS_NOTE_S).toBeLessThan(0.6);
  });

  it("batteria boom-bap: cassa sull'uno, rullante sul 2 e sul 4, charleston sugli ottavi", () => {
    expect(drumsAt(0)).toContain("kick");
    expect(drumsAt(4)).toContain("snare");
    expect(drumsAt(12)).toContain("snare");
    expect(drumsAt(1)).toEqual([]);
    const hats = Array.from({ length: STEPS_PER_BAR }, (_, s) => drumsAt(s).includes("hat")).filter(Boolean);
    expect(hats).toHaveLength(8);
    expect(drumsAt(16)).toEqual(drumsAt(0));
  });

  it("lo swing allunga i pari e accorcia i dispari senza far derivare il tempo", () => {
    expect(stepAdvance(0)).toBeGreaterThan(stepDuration());
    expect(stepAdvance(1)).toBeLessThan(stepDuration());
    let bar = 0;
    for (let s = 0; s < STEPS_PER_BAR; s++) bar += stepAdvance(s);
    expect(bar).toBeCloseTo((60 / LOFI_BPM) * 4, 9); // una battuta dura sempre 4 battiti
  });

  it("l'accordo si suona all'inizio della battuta, con una ribattuta più leggera", () => {
    expect(chordHitAt(0)).toBe("strike");
    expect(chordHitAt(10)).toBe("ghost");
    expect(chordHitAt(3)).toBeNull();
  });
});
