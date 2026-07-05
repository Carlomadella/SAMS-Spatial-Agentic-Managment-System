import { describe, expect, it } from "vitest";
import { clampStep, isLastStep, TOUR_STEPS, tourProgress } from "./tour";

describe("tour steps", () => {
  it("has a welcome step first and stable ids", () => {
    expect(TOUR_STEPS[0].id).toBe("welcome");
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
  });

  it("every non-welcome step targets a data-tour element", () => {
    for (const s of TOUR_STEPS.slice(1)) expect(s.target).toMatch(/^\[data-tour="/);
  });
});

describe("clampStep", () => {
  it("keeps the index within range", () => {
    expect(clampStep(-3)).toBe(0);
    expect(clampStep(999)).toBe(TOUR_STEPS.length - 1);
    expect(clampStep(1.6)).toBe(2);
  });
});

describe("isLastStep", () => {
  it("is true only at the end", () => {
    expect(isLastStep(0)).toBe(false);
    expect(isLastStep(TOUR_STEPS.length - 1)).toBe(true);
  });
});

describe("tourProgress", () => {
  it("reads as n / total", () => {
    expect(tourProgress(0)).toBe(`1 / ${TOUR_STEPS.length}`);
    expect(tourProgress(TOUR_STEPS.length - 1)).toBe(`${TOUR_STEPS.length} / ${TOUR_STEPS.length}`);
  });
});
