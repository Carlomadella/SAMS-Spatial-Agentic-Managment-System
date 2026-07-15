import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  DEFAULT_PALETTE_ID,
  luminance,
  onAccent,
  PALETTES,
  paletteById,
  paletteCss,
  paletteSwatch,
  paletteVars,
  type PaletteTokens,
} from "./palettes";

const TOKEN_KEYS: (keyof PaletteTokens)[] = [
  "ink-950", "ink-900", "ink-850", "ink-800", "ink-700", "ink-600", "ink-500",
  "line", "mut", "text", "text-strong", "accent", "accent-2",
];

describe("PALETTES", () => {
  it("sono cinque, come chiede la roadmap (SAMS + 4 alternative)", () => {
    expect(PALETTES).toHaveLength(5);
  });

  it("c'è la palette che richiama i colori della workspace", () => {
    const sams = paletteById("sams");
    expect(sams.dark.accent).toBe("79 140 255"); // lo stesso blu di --c-accent in index.css
  });

  it("gli id sono unici (altrimenti la scelta sarebbe ambigua)", () => {
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length);
  });

  it("ogni palette definisce tutti i token, in chiaro e in scuro", () => {
    for (const p of PALETTES) {
      for (const mode of ["dark", "light"] as const) {
        for (const k of TOKEN_KEYS) {
          expect(p[mode][k], `${p.id}.${mode}.${k}`).toBeTruthy();
        }
      }
    }
  });

  it("i token sono terne «R G B» senza rgb() — Tailwind ci compone l'alpha", () => {
    for (const p of PALETTES) {
      for (const mode of ["dark", "light"] as const) {
        for (const k of TOKEN_KEYS) {
          expect(p[mode][k], `${p.id}.${mode}.${k}`).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
        }
      }
    }
  });

  it("i canali stanno in 0–255", () => {
    for (const p of PALETTES) {
      for (const mode of ["dark", "light"] as const) {
        for (const k of TOKEN_KEYS) {
          for (const ch of p[mode][k].split(" ").map(Number)) {
            expect(ch, `${p.id}.${mode}.${k}`).toBeGreaterThanOrEqual(0);
            expect(ch, `${p.id}.${mode}.${k}`).toBeLessThanOrEqual(255);
          }
        }
      }
    }
  });

  it("ogni variante scura è davvero scura e ogni chiara davvero chiara", () => {
    // Il testo deve staccare dallo sfondo: in dark il fondo è scuro e il testo chiaro,
    // in light il contrario. Una palette invertita per sbaglio renderebbe il sito illeggibile.
    const luma = (t: string) => {
      const [r, g, b] = t.split(" ").map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const p of PALETTES) {
      expect(luma(p.dark["ink-950"]), `${p.id} dark bg`).toBeLessThan(60);
      expect(luma(p.dark.text), `${p.id} dark text`).toBeGreaterThan(180);
      expect(luma(p.light["ink-950"]), `${p.id} light bg`).toBeGreaterThan(200);
      expect(luma(p.light.text), `${p.id} light text`).toBeLessThan(80);
    }
  });

  it("la scala ink va dal più scuro al più chiaro in dark (e viceversa in light)", () => {
    const luma = (t: string) => {
      const [r, g, b] = t.split(" ").map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const p of PALETTES) {
      // ink-950 è il fondo, ink-500 la superficie più alta: in dark deve schiarire.
      expect(luma(p.dark["ink-500"]), `${p.id}`).toBeGreaterThan(luma(p.dark["ink-950"]));
      expect(luma(p.light["ink-500"]), `${p.id}`).toBeLessThan(luma(p.light["ink-950"]));
    }
  });
});

describe("paletteById", () => {
  it("trova per id", () => {
    expect(paletteById("foresta").name).toMatch(/Foresta/);
  });

  it("ricade sul default per id sconosciuto, nullo o assente (localStorage manomesso)", () => {
    expect(paletteById("inesistente").id).toBe(DEFAULT_PALETTE_ID);
    expect(paletteById(null).id).toBe(DEFAULT_PALETTE_ID);
    expect(paletteById(undefined).id).toBe(DEFAULT_PALETTE_ID);
  });

  it("il default è la palette attuale del sito (nessun cambio di look non richiesto)", () => {
    expect(DEFAULT_PALETTE_ID).toBe("ambra");
  });
});

describe("paletteVars", () => {
  it("emette dichiarazioni CSS col prefisso --c-", () => {
    const css = paletteVars(paletteById("sams").dark);
    expect(css).toContain("--c-ink-950: 10 12 18;");
    expect(css).toContain("--c-accent: 79 140 255;");
  });

  it("copre tutti i token", () => {
    const css = paletteVars(paletteById("sams").dark);
    for (const k of TOKEN_KEYS) expect(css).toContain(`--c-${k}:`);
  });
});

describe("paletteCss", () => {
  it("emette le regole per entrambi i temi, sui selettori di index.css", () => {
    const css = paletteCss(paletteById("foresta"));
    expect(css).toContain("body.site-scroll {");
    expect(css).toContain(".theme-light body.site-scroll {");
  });

  it("la variante chiara usa i token light, non quelli dark", () => {
    const p = paletteById("foresta");
    const css = paletteCss(p);
    const lightRule = css.split(".theme-light")[1];
    expect(lightRule).toContain(`--c-accent: ${p.light.accent};`);
    expect(lightRule).not.toContain(`--c-accent: ${p.dark.accent};`);
  });
});

describe("paletteSwatch", () => {
  it("dà colori rgb() pronti da disegnare", () => {
    const s = paletteSwatch(paletteById("sams"));
    expect(s).toHaveLength(5);
    for (const c of s) expect(c).toMatch(/^rgb\(\d{1,3} \d{1,3} \d{1,3}\)$/);
  });

  it("lo swatch chiaro differisce da quello scuro", () => {
    const p = paletteById("nebulosa");
    expect(paletteSwatch(p, "light")).not.toEqual(paletteSwatch(p, "dark"));
  });
});

describe("contrasto del testo sull'accento", () => {
  it("contrastRatio: nero/bianco è 21, un colore con sé stesso è 1", () => {
    expect(contrastRatio("0 0 0", "255 255 255")).toBeCloseTo(21, 0);
    expect(contrastRatio("120 80 40", "120 80 40")).toBeCloseTo(1, 5);
  });

  it("contrastRatio è simmetrico (l'ordine non conta)", () => {
    expect(contrastRatio("245 158 11", "255 255 255")).toBeCloseTo(contrastRatio("255 255 255", "245 158 11"), 6);
  });

  it("luminance: nero 0, bianco 1", () => {
    expect(luminance("0 0 0")).toBeCloseTo(0, 5);
    expect(luminance("255 255 255")).toBeCloseTo(1, 5);
  });

  it("su ambra brillante sceglie il nero: il bianco darebbe 2.15:1", () => {
    expect(onAccent("245 158 11")).toBe("11 14 20");
    expect(contrastRatio("255 255 255", "245 158 11")).toBeLessThan(3);
  });

  it("su un accento scuro sceglie il bianco quando basta da solo (≥ AA)", () => {
    expect(onAccent("109 60 220")).toBe("255 255 255"); // nebulosa light: 6.31:1
  });

  it("**ogni** palette resta leggibile: il testo sull'accento supera 4.5:1 (AA)", () => {
    for (const p of PALETTES) {
      for (const mode of ["dark", "light"] as const) {
        const fg = onAccent(p[mode].accent);
        expect(contrastRatio(fg, p[mode].accent), `${p.id}/${mode}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("paletteVars emette --c-on-accent derivato (non va scritto a mano)", () => {
    expect(paletteVars(paletteById("ambra").dark)).toContain("--c-on-accent: 11 14 20;");
    expect(paletteVars(paletteById("nebulosa").light)).toContain("--c-on-accent: 255 255 255;");
  });
});
