import { describe, expect, it } from "vitest";
import { countsAsUnread, unreadBadge } from "./chat";

describe("countsAsUnread", () => {
  it("non conta nulla quando la chat è attiva", () => {
    expect(countsAsUnread("Bob", "Ada", true)).toBe(false);
  });
  it("conta i messaggi altrui quando la chat non è attiva", () => {
    expect(countsAsUnread("Bob", "Ada", false)).toBe(true);
  });
  it("non conta i propri messaggi (case/space-insensitive)", () => {
    expect(countsAsUnread("  ada ", "Ada", false)).toBe(false);
  });
  it("usa 'Ospite' come nome di default per il confronto", () => {
    expect(countsAsUnread("ospite", "", false)).toBe(false);
    expect(countsAsUnread("Altro", "", false)).toBe(true);
  });
});

describe("unreadBadge", () => {
  it("vuoto a zero o meno", () => {
    expect(unreadBadge(0)).toBe("");
    expect(unreadBadge(-1)).toBe("");
  });
  it("mostra il numero fino a 9", () => {
    expect(unreadBadge(3)).toBe("3");
    expect(unreadBadge(9)).toBe("9");
  });
  it("cappa a 9+ oltre 9", () => {
    expect(unreadBadge(10)).toBe("9+");
    expect(unreadBadge(42)).toBe("9+");
  });
});
