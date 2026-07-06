import { describe, expect, it } from "vitest";
import { isShared, observerBadge, observerLabel, sanitizeObservers } from "./presence";

describe("presence", () => {
  describe("sanitizeObservers", () => {
    it("passa gli interi non negativi", () => {
      expect(sanitizeObservers(0)).toBe(0);
      expect(sanitizeObservers(3)).toBe(3);
    });
    it("tronca i decimali", () => {
      expect(sanitizeObservers(2.9)).toBe(2);
    });
    it("azzera negativi e non numeri", () => {
      expect(sanitizeObservers(-4)).toBe(0);
      expect(sanitizeObservers("x")).toBe(0);
      expect(sanitizeObservers(null)).toBe(0);
      expect(sanitizeObservers(undefined)).toBe(0);
      expect(sanitizeObservers(Infinity)).toBe(0);
    });
  });

  describe("observerLabel", () => {
    it("0 o 1 vista → solo tu", () => {
      expect(observerLabel(0)).toMatch(/solo tu/i);
      expect(observerLabel(1)).toMatch(/solo tu/i);
    });
    it("2 viste → tu e un'altra (singolare)", () => {
      expect(observerLabel(2)).toMatch(/un'altra vista/i);
    });
    it("3+ viste → plurale con il conteggio degli altri", () => {
      expect(observerLabel(4)).toMatch(/altre 3 viste/i);
    });
  });

  describe("observerBadge", () => {
    it("non scende mai sotto 1", () => {
      expect(observerBadge(0)).toBe(1);
      expect(observerBadge(-2)).toBe(1);
    });
    it("riflette il conteggio quando ≥ 1", () => {
      expect(observerBadge(5)).toBe(5);
    });
  });

  describe("isShared", () => {
    it("falso con 0 o 1 vista, vero da 2 in su", () => {
      expect(isShared(0)).toBe(false);
      expect(isShared(1)).toBe(false);
      expect(isShared(2)).toBe(true);
    });
  });
});
