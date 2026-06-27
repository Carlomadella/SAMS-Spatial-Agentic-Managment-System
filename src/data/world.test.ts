import { describe, expect, it } from "vitest";
import { clampToRoom, zoneForTitle, ZONE_BY_ID } from "./world";

describe("zoneForTitle", () => {
  it("routes writing/docs tasks to the reading nook", () => {
    expect(zoneForTitle("Aggiorna il README")).toBe("whiteboard");
    expect(zoneForTitle("Scrivi la documentazione")).toBe("whiteboard");
    expect(zoneForTitle("Nuovo articolo sul blog")).toBe("whiteboard");
    expect(zoneForTitle("DOCS update")).toBe("whiteboard"); // case-insensitive
  });

  it("routes code tasks to the work desk", () => {
    expect(zoneForTitle("Fix login bug")).toBe("desk");
    expect(zoneForTitle("Refactor the API")).toBe("desk");
    expect(zoneForTitle("Implement feature X")).toBe("desk");
  });

  it("falls back to the desk for anything else", () => {
    expect(zoneForTitle("misc errand")).toBe("desk");
  });

  it("always returns a zone that exists", () => {
    for (const title of ["docs", "fix bug", "whatever"]) {
      expect(ZONE_BY_ID[zoneForTitle(title)]).toBeDefined();
    }
  });
});

describe("clampToRoom", () => {
  it("leaves an interior point unchanged", () => {
    expect(clampToRoom([0, 0])).toEqual([0, 0]);
  });

  it("clamps points beyond the walls to the padded bounds", () => {
    expect(clampToRoom([100, 100])).toEqual([8.4, 5.4]);
    expect(clampToRoom([-100, -100])).toEqual([-8.4, -5.4]);
  });
});
