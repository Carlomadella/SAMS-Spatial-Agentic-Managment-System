import { describe, expect, it } from "vitest";
import { findPath, isPointClear } from "../lib/pathfind";
import {
  BASE_BEDS,
  MAX_WINGS,
  OBSTACLES,
  ROOM,
  buildLayout,
  clampToRoom,
  nextWingCount,
  wingsNeeded,
  zoneForTitle,
} from "./world";

// Test di prima della casa che cresce: valgono identici sulla casa base.
const BASE = buildLayout(0);

describe("zoneForTitle", () => {
  it("routes writing/docs tasks to the reading nook", () => {
    expect(zoneForTitle("Aggiorna il README", BASE)).toBe("whiteboard");
    expect(zoneForTitle("Scrivi la documentazione", BASE)).toBe("whiteboard");
    expect(zoneForTitle("Nuovo articolo sul blog", BASE)).toBe("whiteboard");
    expect(zoneForTitle("DOCS update", BASE)).toBe("whiteboard"); // case-insensitive
  });

  it("routes code tasks to the work desk", () => {
    expect(zoneForTitle("Fix login bug", BASE)).toBe("desk");
    expect(zoneForTitle("Refactor the API", BASE)).toBe("desk");
    expect(zoneForTitle("Implement feature X", BASE)).toBe("desk");
  });

  it("falls back to the desk for anything else", () => {
    expect(zoneForTitle("misc errand", BASE)).toBe("desk");
  });

  it("always returns a zone that exists (con e senza ali)", () => {
    for (const L of [BASE, buildLayout(MAX_WINGS)]) {
      for (const title of ["docs", "fix bug", "whatever", "test CI", "riunione"]) {
        expect(L.zoneById[zoneForTitle(title, L)]).toBeDefined();
      }
    }
  });
});

describe("clampToRoom", () => {
  it("leaves an interior point unchanged", () => {
    expect(clampToRoom([0, 0], BASE)).toEqual([0, 0]);
  });

  it("clamps points beyond the walls to the padded bounds", () => {
    expect(clampToRoom([100, 100], BASE)).toEqual([12.4, 8.4]);
    expect(clampToRoom([-100, -100], BASE)).toEqual([-12.4, -8.4]);
  });

  it("con le ali il confine destro si sposta", () => {
    expect(clampToRoom([100, 0], buildLayout(1))).toEqual([25.4, 0]);
  });
});

describe("buildLayout — la casa base non cambia", () => {
  const base = buildLayout(0);
  it("stessi confini, 6 letti, 5 zone", () => {
    expect(base.bounds).toEqual({ minX: ROOM.minX, maxX: ROOM.maxX, minZ: ROOM.minZ, maxZ: ROOM.maxZ });
    expect(base.beds).toHaveLength(BASE_BEDS);
    expect(base.zones.map((z) => z.id)).toEqual(["desk", "whiteboard", "kitchen", "lounge", "bedroom"]);
    expect(base.wings).toEqual([]);
  });
  it("OBSTACLES esportati = quelli della casa base", () => {
    expect(OBSTACLES).toBe(base.obstacles);
  });
  it("stesso numero di ali → stesso oggetto (niente ricalcoli a ogni render)", () => {
    expect(buildLayout(2)).toBe(buildLayout(2));
  });
});

describe("buildLayout — le ali", () => {
  it("ogni ala allunga la casa di 13 a destra e aggiunge 6 letti e la sua stanza, in ordine", () => {
    const two = buildLayout(2);
    expect(two.bounds.maxX).toBe(ROOM.maxX + 26);
    expect(two.beds).toHaveLength(BASE_BEDS + 12);
    expect(two.wings.map((w) => w.kind)).toEqual(["meeting", "library"]);
    expect(two.zones.map((z) => z.id)).toContain("library");
  });
  it("mai oltre il catalogo", () => {
    expect(buildLayout(99).wings).toHaveLength(MAX_WINGS);
  });
  it("letti e zone delle ali stanno in punti raggiungibili dalla casa base", () => {
    const L = buildLayout(MAX_WINGS);
    // (alcune zone della casa base sono a ridosso dei mobili da sempre: qui si controllano le ali)
    for (const w of L.wings) expect(isPointClear(L.zoneById[w.kind].position, L.obstacles)).toBe(true);
    // dal salotto alla zona di ogni ala esiste un percorso
    for (const w of L.wings) {
      const goal = L.zoneById[w.kind].position;
      const path = findPath([-7, 6], goal, L.obstacles, { bounds: L.bounds });
      expect(path.length).toBeGreaterThan(0);
      const last = path[path.length - 1];
      expect(Math.hypot(last[0] - goal[0], last[1] - goal[1])).toBeLessThan(0.8);
    }
  });
  it("si arriva vicino a ogni letto delle ali", () => {
    const L = buildLayout(2);
    for (const bed of L.beds.slice(BASE_BEDS)) {
      const path = findPath([-7, 6], bed, L.obstacles, { bounds: L.bounds });
      expect(path.length).toBeGreaterThan(0);
      const last = path[path.length - 1];
      expect(Math.hypot(last[0] - bed[0], last[1] - bed[1])).toBeLessThan(2.2);
    }
  });
});

describe("quante ali", () => {
  it("la prima al 7° agente, poi una ogni 6", () => {
    expect(wingsNeeded(6)).toBe(0);
    expect(wingsNeeded(7)).toBe(1);
    expect(wingsNeeded(12)).toBe(1);
    expect(wingsNeeded(13)).toBe(2);
    expect(wingsNeeded(500)).toBe(MAX_WINGS);
  });
  it("cresce subito", () => {
    expect(nextWingCount(7, 0)).toBe(1);
    expect(nextWingCount(13, 1)).toBe(2);
  });
  it("si restringe solo con 3 agenti di margine sotto la soglia", () => {
    // ala 1 nasce a 7: resta con 6 e 5, sparisce a 4
    expect(nextWingCount(6, 1)).toBe(1);
    expect(nextWingCount(5, 1)).toBe(1);
    expect(nextWingCount(4, 1)).toBe(0);
    // ala 2 nasce a 13: resta fino a 11, a 10 si torna a una
    expect(nextWingCount(11, 2)).toBe(2);
    expect(nextWingCount(10, 2)).toBe(1);
    // crollo improvviso: si scende fino a quanto serve
    expect(nextWingCount(1, 3)).toBe(0);
  });
});

describe("zoneForTitle — il tipo di task sceglie la stanza", () => {
  it("senza ali: come prima", () => {
    const L = buildLayout(0);
    expect(zoneForTitle("Aggiorna il README", L)).toBe("whiteboard");
    expect(zoneForTitle("Scrivi i test del login", L)).toBe("desk");
    expect(zoneForTitle("Riunione di allineamento", L)).toBe("desk");
  });
  it("con le ali: riunioni, biblioteca e laboratorio", () => {
    const L = buildLayout(3);
    expect(zoneForTitle("Riunione di allineamento", L)).toBe("meeting");
    expect(zoneForTitle("Ricerca sulle librerie", L)).toBe("library");
    expect(zoneForTitle("Scrivi i test del login", L)).toBe("lab");
    expect(zoneForTitle("Correggi il bug del form", L)).toBe("desk");
  });
});
