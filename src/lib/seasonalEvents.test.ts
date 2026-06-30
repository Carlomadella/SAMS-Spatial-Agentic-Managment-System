import { describe, it, expect } from "vitest";
import { getSeasonalEvent } from "./seasonalEvents";

// Mese 1-12 → costruisce una Date locale (getMonth è 0-based).
const day = (month: number, d: number) => new Date(2026, month - 1, d, 12, 0, 0);

describe("getSeasonalEvent", () => {
  it("riconosce Capodanno il 1° gennaio e il 31 dicembre", () => {
    expect(getSeasonalEvent(day(1, 1))?.id).toBe("capodanno");
    expect(getSeasonalEvent(day(12, 31))?.id).toBe("capodanno");
  });

  it("riconosce San Valentino solo il 14 febbraio", () => {
    expect(getSeasonalEvent(day(2, 14))?.id).toBe("san-valentino");
    expect(getSeasonalEvent(day(2, 13))).toBeNull();
    expect(getSeasonalEvent(day(2, 15))).toBeNull();
  });

  it("riconosce la fioritura di primavera (20-22 marzo)", () => {
    expect(getSeasonalEvent(day(3, 20))?.id).toBe("fioritura");
    expect(getSeasonalEvent(day(3, 22))?.id).toBe("fioritura");
    expect(getSeasonalEvent(day(3, 19))).toBeNull();
    expect(getSeasonalEvent(day(3, 23))).toBeNull();
  });

  it("riconosce il solstizio d'estate (20-22 giugno)", () => {
    expect(getSeasonalEvent(day(6, 21))?.id).toBe("solstizio");
  });

  it("riconosce Halloween (29-31 ottobre)", () => {
    expect(getSeasonalEvent(day(10, 31))?.id).toBe("halloween");
    expect(getSeasonalEvent(day(10, 28))).toBeNull();
  });

  it("distingue Natale (20-26 dic) da Capodanno (31 dic) senza sovrapporsi", () => {
    expect(getSeasonalEvent(day(12, 25))?.id).toBe("natale");
    expect(getSeasonalEvent(day(12, 26))?.id).toBe("natale");
    expect(getSeasonalEvent(day(12, 30))).toBeNull(); // buco voluto tra Natale e Capodanno
    expect(getSeasonalEvent(day(12, 31))?.id).toBe("capodanno");
  });

  it("restituisce null in un giorno qualunque senza ricorrenze", () => {
    expect(getSeasonalEvent(day(7, 15))).toBeNull();
    expect(getSeasonalEvent(day(9, 3))).toBeNull();
  });

  it("ogni evento espone i campi richiesti per UI e scena 3D", () => {
    const e = getSeasonalEvent(day(12, 25));
    expect(e).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      emoji: expect.any(String),
      accent: expect.stringMatching(/^#[0-9a-f]{6}$/i),
      blurb: expect.any(String),
    });
  });
});
