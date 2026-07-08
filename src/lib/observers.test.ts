import { describe, expect, it } from "vitest";
import { avatarColor, initialsOf, observerRoster, overflowCount, MAX_AVATARS, AVATAR_COLORS } from "./observers";

describe("initialsOf", () => {
  it("una parola → prime due lettere maiuscole", () => {
    expect(initialsOf("carlo")).toBe("CA");
    expect(initialsOf("A")).toBe("A");
  });
  it("più parole → iniziali di prima e ultima", () => {
    expect(initialsOf("Carlo Madella")).toBe("CM");
    expect(initialsOf("Anna Maria Rossi")).toBe("AR");
  });
  it("vuoto → punto interrogativo", () => {
    expect(initialsOf("   ")).toBe("?");
  });
});

describe("avatarColor", () => {
  it("è deterministico e nella palette", () => {
    const c = avatarColor("carlo");
    expect(c).toBe(avatarColor("carlo"));
    expect(AVATAR_COLORS).toContain(c);
  });
});

describe("observerRoster", () => {
  it("mette 'tu' in testa e lo marca", () => {
    const r = observerRoster(["Bea", "Carlo"], "Carlo");
    expect(r[0]).toMatchObject({ name: "Carlo", isYou: true });
    expect(r.filter((x) => x.isYou)).toHaveLength(1);
  });
  it("deduplica per nome case-insensitive", () => {
    const r = observerRoster(["carlo", "CARLO", "Bea"], "Carlo");
    expect(r.map((x) => x.name.toLowerCase())).toEqual(["carlo", "bea"]);
  });
  it("ricade su 'Ospite' senza nome", () => {
    const r = observerRoster([], "");
    expect(r).toEqual([{ name: "Ospite", initial: "OS", color: avatarColor("Ospite"), isYou: true }]);
  });
  it("cappa a MAX_AVATARS", () => {
    const many = Array.from({ length: 20 }, (_, i) => `Utente${i}`);
    expect(observerRoster(many, "Io")).toHaveLength(MAX_AVATARS);
  });
});

describe("overflowCount", () => {
  it("0 quando entra tutto", () => {
    expect(overflowCount(["Bea", "Carlo"], "Io")).toBe(0);
  });
  it("conta le persone distinte oltre il cap", () => {
    const many = Array.from({ length: 20 }, (_, i) => `Utente${i}`);
    // 20 estranei + me = 21 distinti; overflow = 21 - 8
    expect(overflowCount(many, "Io")).toBe(21 - MAX_AVATARS);
  });
});
