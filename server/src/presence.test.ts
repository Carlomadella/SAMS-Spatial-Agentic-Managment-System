import { describe, expect, it } from "vitest";
import { distinctPeople, presenceState, sanitizeObserverIdentity, type Observer } from "./presence";

describe("presence", () => {
  describe("sanitizeObserverIdentity", () => {
    it("ripulisce id e nome con trim + clamp", () => {
      const o = sanitizeObserverIdentity("  abc  ", "  Ada  ");
      expect(o).toEqual({ id: "abc", name: "Ada" });
    });
    it("nome vuoto o non stringa → fallback Ospite", () => {
      expect(sanitizeObserverIdentity("id", "").name).toBe("Ospite");
      expect(sanitizeObserverIdentity("id", "   ").name).toBe("Ospite");
      expect(sanitizeObserverIdentity("id", 42).name).toBe("Ospite");
    });
    it("id non stringa → anonimo (vuoto), non inventato", () => {
      expect(sanitizeObserverIdentity(undefined, "Bob").id).toBe("");
      expect(sanitizeObserverIdentity(123, "Bob").id).toBe("");
    });
    it("tronca id e nome alle lunghezze massime", () => {
      const o = sanitizeObserverIdentity("x".repeat(200), "y".repeat(200));
      expect(o.id.length).toBe(64);
      expect(o.name.length).toBe(40);
    });
  });

  describe("distinctPeople", () => {
    it("deduplica per id, prima occorrenza del nome vince", () => {
      const obs: Observer[] = [
        { id: "1", name: "Ada" },
        { id: "1", name: "Ada (2ª scheda)" },
        { id: "2", name: "Bob" },
      ];
      expect(distinctPeople(obs)).toEqual(["Ada", "Bob"]);
    });
    it("le viste anonime (id vuoto) contano ciascuna", () => {
      const obs: Observer[] = [
        { id: "", name: "Ospite" },
        { id: "", name: "Ospite" },
      ];
      expect(distinctPeople(obs)).toEqual(["Ospite", "Ospite"]);
    });
    it("ordina in modo stabile e case-insensitive", () => {
      const obs: Observer[] = [
        { id: "1", name: "zoe" },
        { id: "2", name: "Ada" },
        { id: "3", name: "bob" },
      ];
      expect(distinctPeople(obs)).toEqual(["Ada", "bob", "zoe"]);
    });
    it("nessun osservatore → lista vuota", () => {
      expect(distinctPeople([])).toEqual([]);
    });
  });

  describe("presenceState", () => {
    it("views conta le connessioni, people i nomi distinti", () => {
      const obs: Observer[] = [
        { id: "1", name: "Ada" },
        { id: "1", name: "Ada" }, // stessa persona, due schede
        { id: "2", name: "Bob" },
      ];
      expect(presenceState(obs)).toEqual({ views: 3, people: ["Ada", "Bob"] });
    });
  });
});
