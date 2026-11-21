import { describe, expect, it } from "vitest";
import { DEFAULT_MAX_STEPS, maxStepsFromEnv } from "./agentTools";

describe("maxStepsFromEnv — turni per task", () => {
  it("24 di base: 14 non bastavano per un task con più correzioni", () => {
    expect(DEFAULT_MAX_STEPS).toBe(24);
    expect(maxStepsFromEnv({})).toBe(24);
  });

  it("regolabile con SAMS_MAX_STEPS", () => {
    expect(maxStepsFromEnv({ SAMS_MAX_STEPS: "30" })).toBe(30);
  });

  it("valori assurdi tornano al default", () => {
    for (const v of ["", "abc", "2", "1000", "12.5", "-3"]) {
      expect(maxStepsFromEnv({ SAMS_MAX_STEPS: v })).toBe(24);
    }
  });
});
