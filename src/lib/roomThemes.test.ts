import { describe, it, expect } from "vitest";
import { ROOM_THEMES, DEFAULT_ROOM_THEME, getRoomTheme } from "./roomThemes";

const HEX = /^#[0-9a-f]{6}$/i;

describe("ROOM_THEMES", () => {
  it("ogni tema espone id, nome, emoji e 5 colori hex validi", () => {
    for (const t of ROOM_THEMES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.emoji).toBeTruthy();
      for (const c of [t.wall, t.wallLower, t.floor, t.trim, t.baseboard]) {
        expect(c).toMatch(HEX);
      }
    }
  });

  it("gli id sono unici", () => {
    const ids = ROOM_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("il tema di default esiste nella lista", () => {
    expect(ROOM_THEMES.some((t) => t.id === DEFAULT_ROOM_THEME)).toBe(true);
  });
});

describe("getRoomTheme", () => {
  it("restituisce il tema richiesto", () => {
    expect(getRoomTheme("cool").id).toBe("cool");
  });

  it("ricade sul default per id sconosciuto o assente", () => {
    expect(getRoomTheme("non-esiste").id).toBe(DEFAULT_ROOM_THEME);
    expect(getRoomTheme(undefined).id).toBe(DEFAULT_ROOM_THEME);
  });
});
