import { describe, expect, it } from "vitest";
import { isMobileWidth, MOBILE_BREAKPOINT } from "./layout";

describe("isMobileWidth", () => {
  it("vero sotto la soglia", () => {
    expect(isMobileWidth(320)).toBe(true);
    expect(isMobileWidth(767)).toBe(true);
  });
  it("falso alla soglia e sopra", () => {
    expect(isMobileWidth(MOBILE_BREAKPOINT)).toBe(false);
    expect(isMobileWidth(1024)).toBe(false);
  });
  it("falso su valori non finiti", () => {
    expect(isMobileWidth(NaN)).toBe(false);
  });
});
