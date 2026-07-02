import { describe, it, expect } from "vitest";
import {
  buildGardenOgCard,
  buildWorkspaceOgCard,
  ogFileName,
  OG_HEIGHT,
  OG_WIDTH,
  shade,
} from "./ogImage";
import type { GardenState } from "./garden";

function garden(partial: Partial<GardenState> = {}): GardenState {
  return {
    user: "carlo",
    waterings: 12,
    streak: 4,
    lastWateredDate: null,
    lastSeen: null,
    stage: "tree",
    growth: 82.4,
    thirsty: false,
    updatedAt: "",
    ...partial,
  };
}

describe("buildGardenOgCard", () => {
  it("mappa stato → card con dimensioni OG e statistiche", () => {
    const c = buildGardenOgCard(garden());
    expect(c.width).toBe(OG_WIDTH);
    expect(c.height).toBe(OG_HEIGHT);
    expect(c.title).toBe("carlo");
    expect(c.badge).toBe("Albero");
    expect(c.emoji).toBe("🌳");
    expect(c.stats.map((s) => s.value)).toEqual(["12", "4", "82%"]);
  });

  it("mostra il messaggio 'assetata' quando thirsty", () => {
    expect(buildGardenOgCard(garden({ thirsty: true })).footer).toContain("Assetata");
  });

  it("cambia emoji e accento con lo stadio", () => {
    expect(buildGardenOgCard(garden({ stage: "seed" })).emoji).toBe("🌰");
    expect(buildGardenOgCard(garden({ stage: "blooming" })).emoji).toBe("🌸");
  });
});

describe("buildWorkspaceOgCard", () => {
  it("formatta i token e le stat", () => {
    const c = buildWorkspaceOgCard({ agents: 6, tasksCompleted: 3, prsOpened: 2, tokensUsed: 15400 });
    expect(c.badge).toBe("6 agenti");
    expect(c.stats.map((s) => s.value)).toEqual(["3", "2", "15.4k"]);
  });
});

describe("shade", () => {
  it("scurisce e schiarisce un hex", () => {
    expect(shade("#808080", -1)).toBe("#000000");
    expect(shade("#808080", 1)).toBe("#ffffff");
    expect(shade("#808080", 0)).toBe("#808080");
  });
  it("ritorna l'input se non è hex valido", () => {
    expect(shade("rgb(0,0,0)", 0.5)).toBe("rgb(0,0,0)");
  });
});

describe("ogFileName", () => {
  it("slugifica il titolo", () => {
    expect(ogFileName({ ...buildWorkspaceOgCard({ agents: 1, tasksCompleted: 0, prsOpened: 0, tokensUsed: 0 }) })).toBe(
      "sams-il-mio-ufficio-di-agenti.png",
    );
    expect(ogFileName(buildGardenOgCard(garden({ user: "Mario Rossi!" })))).toBe("sams-mario-rossi.png");
  });
});
