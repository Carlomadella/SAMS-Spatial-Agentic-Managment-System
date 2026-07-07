import { describe, it, expect } from "vitest";
import { seasonOf, getWeather, type Season } from "./weather";

// Mese 1-12 → Date locale (getMonth è 0-based).
const day = (month: number, d: number) => new Date(2026, month - 1, d, 12, 0, 0);

describe("seasonOf", () => {
  it("mappa i mesi sulle stagioni meteorologiche (emisfero nord)", () => {
    expect(seasonOf(day(12, 1))).toBe("winter");
    expect(seasonOf(day(1, 15))).toBe("winter");
    expect(seasonOf(day(2, 28))).toBe("winter");
    expect(seasonOf(day(3, 1))).toBe("spring");
    expect(seasonOf(day(5, 31))).toBe("spring");
    expect(seasonOf(day(6, 1))).toBe("summer");
    expect(seasonOf(day(8, 31))).toBe("summer");
    expect(seasonOf(day(9, 1))).toBe("autumn");
    expect(seasonOf(day(11, 30))).toBe("autumn");
  });

  it("copre tutti e 12 i mesi senza buchi", () => {
    const seen = new Set<Season>();
    for (let m = 1; m <= 12; m++) seen.add(seasonOf(day(m, 15)));
    expect(seen).toEqual(new Set(["winter", "spring", "summer", "autumn"]));
  });
});

describe("getWeather", () => {
  it("associa a ogni stagione la precipitazione attesa", () => {
    expect(getWeather(day(1, 10)).precipitation).toBe("snow");
    expect(getWeather(day(4, 10)).precipitation).toBe("petals");
    expect(getWeather(day(7, 10)).precipitation).toBe("none");
    expect(getWeather(day(10, 10)).precipitation).toBe("rain");
  });

  it("espone i campi richiesti da UI e scena 3D, con hex validi", () => {
    for (let m = 1; m <= 12; m++) {
      const w = getWeather(day(m, 15));
      expect(w).toMatchObject({
        season: expect.any(String),
        seasonName: expect.any(String),
        emoji: expect.any(String),
        precipitation: expect.any(String),
        particleColor: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        tint: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        blurb: expect.any(String),
      });
    }
  });

  it("tiene la tinta stagionale sottile (tintStrength in un range discreto)", () => {
    for (let m = 1; m <= 12; m++) {
      const s = getWeather(day(m, 15)).tintStrength;
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThanOrEqual(0.2);
    }
  });

  it("è deterministico: stessa data → stesso meteo (stessa reference)", () => {
    expect(getWeather(day(2, 2))).toBe(getWeather(day(1, 20)));
    expect(getWeather(day(7, 1))).not.toBe(getWeather(day(1, 1)));
  });
});
