import { describe, it, expect } from "vitest";
import { currentRepo, runWithRepo } from "./github";
import { getSettings } from "./config";

describe("currentRepo / runWithRepo (meta-agente repo override)", () => {
  it("torna al repo globale fuori da ogni override", () => {
    expect(currentRepo()).toBe(getSettings().githubRepo);
  });

  it("usa il repo override dentro runWithRepo", () => {
    runWithRepo("acme/widgets", () => {
      expect(currentRepo()).toBe("acme/widgets");
    });
  });

  it("ripristina il repo globale dopo l'override", () => {
    runWithRepo("acme/widgets", () => {});
    expect(currentRepo()).toBe(getSettings().githubRepo);
  });

  it("propaga l'override attraverso gli await (AsyncLocalStorage)", async () => {
    await runWithRepo("meta/sams", async () => {
      await Promise.resolve();
      expect(currentRepo()).toBe("meta/sams");
    });
  });

  it("isola override annidati", () => {
    runWithRepo("outer/repo", () => {
      expect(currentRepo()).toBe("outer/repo");
      runWithRepo("inner/repo", () => {
        expect(currentRepo()).toBe("inner/repo");
      });
      expect(currentRepo()).toBe("outer/repo");
    });
  });
});
