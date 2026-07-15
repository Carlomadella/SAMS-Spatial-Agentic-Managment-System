import { describe, expect, it } from "vitest";
import {
  hashToken,
  isTokenUsable,
  newToken,
  RESET_TTL_MS,
  tokenExpiry,
  tokenHashEquals,
  tokenRejection,
  VERIFY_TTL_MS,
  type TokenRecord,
} from "./tokens";

const rec = (over: Partial<TokenRecord> = {}): TokenRecord => ({
  tokenHash: over.tokenHash ?? "h",
  userId: over.userId ?? "u1",
  createdAt: over.createdAt ?? 1_000,
  expiresAt: over.expiresAt ?? 61_000,
  usedAt: over.usedAt ?? null,
});

describe("newToken", () => {
  it("genera 256 bit esadecimali", () => {
    expect(newToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("non si ripete (imprevedibile)", () => {
    const seen = new Set(Array.from({ length: 50 }, () => newToken()));
    expect(seen.size).toBe(50);
  });
});

describe("hashToken", () => {
  it("è deterministico e non restituisce il token in chiaro", () => {
    const t = newToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(t);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("token diversi → hash diversi", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });

  it("non lancia su input non stringa (input non fidato dal client)", () => {
    expect(() => hashToken(undefined as unknown as string)).not.toThrow();
    expect(() => hashToken(null as unknown as string)).not.toThrow();
  });
});

describe("tokenHashEquals", () => {
  it("vero solo per hash identici", () => {
    expect(tokenHashEquals("abc", "abc")).toBe(true);
    expect(tokenHashEquals("abc", "abd")).toBe(false);
  });

  it("falso (senza lanciare) per lunghezze diverse", () => {
    expect(tokenHashEquals("abc", "abcd")).toBe(false);
    expect(tokenHashEquals("", "x")).toBe(false);
  });
});

describe("tokenExpiry", () => {
  it("somma il TTL a now", () => {
    expect(tokenExpiry(RESET_TTL_MS, 1_000)).toBe(1_000 + 60 * 60 * 1000);
    expect(tokenExpiry(VERIFY_TTL_MS, 0)).toBe(24 * 60 * 60 * 1000);
  });

  it("il reset dura meno della verifica (finestra d'attacco più corta)", () => {
    expect(RESET_TTL_MS).toBeLessThan(VERIFY_TTL_MS);
  });
});

describe("isTokenUsable", () => {
  it("spendibile se non usato e non scaduto", () => {
    expect(isTokenUsable(rec(), 30_000)).toBe(true);
  });

  it("non spendibile se già usato, anche se non scaduto", () => {
    expect(isTokenUsable(rec({ usedAt: 20_000 }), 30_000)).toBe(false);
  });

  it("non spendibile se scaduto", () => {
    expect(isTokenUsable(rec(), 61_001)).toBe(false);
  });

  it("la scadenza è esclusiva: a expiresAt esatto è già morto", () => {
    expect(isTokenUsable(rec(), 61_000)).toBe(false);
    expect(isTokenUsable(rec(), 60_999)).toBe(true);
  });

  it("un token inesistente non è spendibile", () => {
    expect(isTokenUsable(null, 0)).toBe(false);
    expect(isTokenUsable(undefined, 0)).toBe(false);
  });
});

describe("tokenRejection", () => {
  it("null quando il token è spendibile", () => {
    expect(tokenRejection(rec(), 30_000)).toBeNull();
  });

  it("distingue sconosciuto / usato / scaduto", () => {
    expect(tokenRejection(null, 0)).toBe("unknown");
    expect(tokenRejection(rec({ usedAt: 5 }), 30_000)).toBe("used");
    expect(tokenRejection(rec(), 99_999)).toBe("expired");
  });

  it("«usato» ha la precedenza su «scaduto» (il messaggio più utile)", () => {
    expect(tokenRejection(rec({ usedAt: 5 }), 99_999)).toBe("used");
  });
});
