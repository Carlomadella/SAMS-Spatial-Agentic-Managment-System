import { describe, expect, it } from "vitest";
import { STREAM_STALE_MS, isStale, reconnectDelay } from "./streamHealth";

describe("reconnectDelay", () => {
  it("raddoppia a ogni tentativo partendo da 1 s", () => {
    expect([0, 1, 2, 3, 4].map(reconnectDelay)).toEqual([1000, 2000, 4000, 8000, 16000]);
  });

  it("non supera i 30 s, nemmeno dopo molti tentativi", () => {
    expect(reconnectDelay(5)).toBe(30000);
    expect(reconnectDelay(1000)).toBe(30000);
  });

  it("tratta tentativi negativi o frazionari come il primo/intero", () => {
    expect(reconnectDelay(-3)).toBe(1000);
    expect(reconnectDelay(1.9)).toBe(2000);
  });
});

describe("isStale", () => {
  it("vivo finché il silenzio resta sotto la soglia", () => {
    expect(isStale(0, STREAM_STALE_MS)).toBe(false);
  });

  it("morto appena il silenzio supera la soglia (più di due ping persi)", () => {
    expect(isStale(0, STREAM_STALE_MS + 1)).toBe(true);
  });
});
