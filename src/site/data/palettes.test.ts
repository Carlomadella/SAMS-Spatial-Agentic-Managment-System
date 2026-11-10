import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { contrastRatio, luminance, ROSSONERO, type PaletteTokens } from "./palettes";

const TOKEN_KEYS: (keyof PaletteTokens)[] = [
  "ink-950", "ink-900", "ink-850", "ink-800", "ink-700", "ink-600", "ink-500",
  "line", "mut", "text", "text-strong", "accent", "accent-2", "accent-soft",
];
const MODES = ["dark", "light"] as const;
const rgb = (t: string) => t.split(" ").map(Number);

describe("ROSSONERO", () => {
  it("i token sono terne «R G B» in 0–255 — Tailwind ci compone l'alpha", () => {
    for (const mode of MODES) {
      for (const k of TOKEN_KEYS) {
        expect(ROSSONERO[mode][k], `${mode}.${k}`).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
        for (const ch of rgb(ROSSONERO[mode][k])) expect(ch).toBeLessThanOrEqual(255);
      }
    }
  });

  it("i neri e i grigi sono neutri: nessuna dominante blu o marrone", () => {
    for (const mode of MODES) {
      for (const k of ["ink-950", "ink-900", "ink-850", "ink-800", "ink-700", "ink-600", "ink-500", "line", "mut", "text"] as const) {
        const [r, g, b] = rgb(ROSSONERO[mode][k]);
        expect(r === g && g === b, `${mode}.${k} = ${ROSSONERO[mode][k]}`).toBe(true);
      }
    }
  });

  it("in scuro il fondo è nero pieno", () => {
    expect(ROSSONERO.dark["ink-950"]).toBe("0 0 0");
  });

  it("l'accento è rosso pieno, non rosa: verde e blu restano bassi (anche nel rosso «soft»)", () => {
    for (const mode of MODES) {
      for (const k of ["accent", "accent-soft"] as const) {
        const [r, g, b] = rgb(ROSSONERO[mode][k]);
        expect(r, `${mode}.${k}`).toBeGreaterThan(150);
        expect(Math.max(g, b), `${mode}.${k}`).toBeLessThanOrEqual(60);
      }
    }
  });

  it("il secondo colore è quello dello stemma: bianco sul nero, nero sul bianco", () => {
    expect(ROSSONERO.dark["accent-2"]).toBe("255 255 255");
    expect(ROSSONERO.light["accent-2"]).toBe("0 0 0");
  });

  it("il bianco sul rosso dei bottoni supera 4.5:1 (AA), in entrambi i temi", () => {
    for (const mode of MODES) {
      expect(contrastRatio("255 255 255", ROSSONERO[mode].accent), mode).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("il rosso «soft» si legge sul fondo come testo (≥ 4.5:1)", () => {
    for (const mode of MODES) {
      expect(contrastRatio(ROSSONERO[mode]["accent-soft"], ROSSONERO[mode]["ink-900"]), mode).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("vale per tutto il progetto: i token di index.css sono questi", () => {
    const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8"); // ?raw sul CSS è vuoto in vitest
    const block = (sel: string) => css.slice(css.indexOf(sel + " {"), css.indexOf("}", css.indexOf(sel + " {")));
    for (const [sel, tokens] of [[":root", ROSSONERO.dark], [".theme-light", ROSSONERO.light]] as const) {
      const rule = block(sel);
      for (const k of TOKEN_KEYS) expect(rule, `${sel} --c-${k}`).toContain(`--c-${k}: ${tokens[k]};`);
    }
  });
});

describe("contrasto", () => {
  it("contrastRatio: nero/bianco è 21, un colore con sé stesso è 1", () => {
    expect(contrastRatio("0 0 0", "255 255 255")).toBeCloseTo(21, 0);
    expect(contrastRatio("120 80 40", "120 80 40")).toBeCloseTo(1, 5);
  });

  it("contrastRatio è simmetrico (l'ordine non conta)", () => {
    expect(contrastRatio("227 6 19", "255 255 255")).toBeCloseTo(contrastRatio("255 255 255", "227 6 19"), 6);
  });

  it("luminance: nero 0, bianco 1", () => {
    expect(luminance("0 0 0")).toBeCloseTo(0, 5);
    expect(luminance("255 255 255")).toBeCloseTo(1, 5);
  });
});
