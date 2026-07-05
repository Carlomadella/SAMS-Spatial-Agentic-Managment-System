import { describe, expect, it } from "vitest";
import { clampStep, isLastStep, placeTourCard, TOUR_STEPS, tourProgress } from "./tour";

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

describe("placeTourCard", () => {
  const vp = { width: 1280, height: 800 };
  const card = { w: 320, h: 200 };
  const M = 12;
  const fits = (p: { top: number; left: number }) => {
    expect(p.top).toBeGreaterThanOrEqual(M);
    expect(p.left).toBeGreaterThanOrEqual(M);
    expect(p.top + card.h).toBeLessThanOrEqual(vp.height - M + 0.001);
    expect(p.left + card.w).toBeLessThanOrEqual(vp.width - M + 0.001);
  };

  it("centres when there is no target", () => {
    const p = placeTourCard(null, card, vp);
    expect(p).toEqual({ top: (800 - 200) / 2, left: (1280 - 320) / 2 });
  });

  it("keeps the card on-screen for a full-height right column (the 4/6 bug)", () => {
    // Inspector: tall as the whole viewport, pinned to the right edge.
    const rect = { top: 40, left: 1280 - 296, width: 296, height: 760 };
    const p = placeTourCard(rect, card, vp);
    fits(p);
    // must sit to the LEFT of the panel, never pushed above the top edge
    expect(p.left + card.w).toBeLessThanOrEqual(rect.left + 0.001);
    expect(p.top).toBeGreaterThanOrEqual(M);
  });

  it("places below a small top button", () => {
    const rect = { top: 8, left: 900, width: 90, height: 28 };
    const p = placeTourCard(rect, card, vp);
    fits(p);
    expect(p.top).toBeGreaterThanOrEqual(rect.top + rect.height);
  });

  it("places above a bottom panel", () => {
    const rect = { top: 800 - 248, left: 300, width: 700, height: 240 };
    const p = placeTourCard(rect, card, vp);
    fits(p);
    expect(p.top + card.h).toBeLessThanOrEqual(rect.top + 0.001);
  });

  it("centres and clamps when the target fills the screen", () => {
    const rect = { top: 0, left: 0, width: 1280, height: 800 };
    const p = placeTourCard(rect, card, vp);
    fits(p);
  });
});
