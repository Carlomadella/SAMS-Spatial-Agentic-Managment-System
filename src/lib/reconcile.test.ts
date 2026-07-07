import { describe, expect, it } from "vitest";
import { compareVersion, nextBase } from "./reconcile";

describe("compareVersion", () => {
  it("behind quando il server è avanti", () => {
    expect(compareVersion(3, 5)).toBe("behind");
    expect(compareVersion(0, 1)).toBe("behind");
  });
  it("ahead quando il client ha una base più alta", () => {
    expect(compareVersion(5, 3)).toBe("ahead");
  });
  it("in-sync a pari versione", () => {
    expect(compareVersion(4, 4)).toBe("in-sync");
    expect(compareVersion(0, 0)).toBe("in-sync");
  });
});

describe("nextBase", () => {
  it("adotta la versione del server dopo un push andato a buon fine", () => {
    expect(nextBase(4, 5)).toBe(5);
  });
  it("si allinea alla versione remota più alta dopo un conflitto (409)", () => {
    expect(nextBase(4, 7)).toBe(7);
  });
  it("non indietreggia mai (monotòna)", () => {
    expect(nextBase(9, 4)).toBe(9);
    expect(nextBase(5, 5)).toBe(5);
  });
});
