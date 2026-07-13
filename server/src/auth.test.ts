import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  newSessionToken,
  normalizeEmail,
  isValidEmail,
  validatePassword,
  sanitizeName,
  publicUser,
} from "./auth";

describe("hashPassword / verifyPassword", () => {
  it("verifica la password corretta e rifiuta quella sbagliata", () => {
    const stored = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse battery", stored)).toBe(true);
    expect(verifyPassword("wrong", stored)).toBe(false);
  });

  it("due hash della stessa password differiscono (salt casuale) ma verificano entrambi", () => {
    const a = hashPassword("s3cretpass");
    const b = hashPassword("s3cretpass");
    expect(a).not.toBe(b);
    expect(verifyPassword("s3cretpass", a)).toBe(true);
    expect(verifyPassword("s3cretpass", b)).toBe(true);
  });

  it("è robusto a stored malformato", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "nosaltnohash")).toBe(false);
  });
});

describe("newSessionToken", () => {
  it("genera token esadecimali unici da 64 char (256 bit)", () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe("normalizeEmail / isValidEmail", () => {
  it("normalizza trim + minuscolo", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
    expect(normalizeEmail(42)).toBe("");
  });
  it("valida il formato base", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("no-at")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });
});

describe("validatePassword", () => {
  it("rifiuta le password troppo corte", () => {
    expect(validatePassword("short").ok).toBe(false);
    expect(validatePassword("12345678").ok).toBe(true);
    expect(validatePassword(123).ok).toBe(false);
  });
});

describe("sanitizeName", () => {
  it("ripulisce e cappa, con fallback dall'email", () => {
    expect(sanitizeName("  Mario  Rossi ")).toBe("Mario Rossi");
    expect(sanitizeName("", "carlo@x.com")).toBe("Carlo");
    expect(sanitizeName("x".repeat(60)).length).toBe(40);
  });
});

describe("publicUser", () => {
  it("non espone mai l'hash", () => {
    const pub = publicUser({ email: "a@b.co", name: "A", role: "owner" });
    expect(pub).toEqual({ email: "a@b.co", name: "A", role: "owner" });
    expect("passHash" in pub).toBe(false);
  });
});
