import { describe, expect, it } from "vitest";
import { isTaskCommand, parseTaskCommand } from "./chatCommands";

describe("parseTaskCommand", () => {
  it("non è un comando se non inizia con /task", () => {
    expect(parseTaskCommand("ciao a tutti")).toBeNull();
    expect(parseTaskCommand("/taskforce ok")).toBeNull(); // /task come parola intera
    expect(parseTaskCommand("")).toBeNull();
    expect(parseTaskCommand(42)).toBeNull();
  });

  it("/task <titolo> senza agente", () => {
    expect(parseTaskCommand("/task sistema il bug del login")).toEqual({
      agent: null,
      title: "sistema il bug del login",
    });
  });

  it("è case-insensitive e tollera spazi extra", () => {
    expect(parseTaskCommand("  /TASK   pulisci i log  ")).toEqual({
      agent: null,
      title: "pulisci i log",
    });
  });

  it("/task @agente <titolo> targettizza per nome", () => {
    expect(parseTaskCommand("/task @Ada sistema il login")).toEqual({
      agent: "Ada",
      title: "sistema il login",
    });
  });

  it("un titolo con due punti non viene scambiato per agente (serve @)", () => {
    expect(parseTaskCommand("/task refactor: estrai modulo")).toEqual({
      agent: null,
      title: "refactor: estrai modulo",
    });
  });

  it("titolo vuoto → null", () => {
    expect(parseTaskCommand("/task")).toBeNull();
    expect(parseTaskCommand("/task    ")).toBeNull();
    expect(parseTaskCommand("/task @Ada")).toBeNull(); // solo agente, niente titolo
  });

  it("clampa agente e titolo alle lunghezze massime", () => {
    const cmd = parseTaskCommand(`/task @${"a".repeat(80)} ${"b".repeat(400)}`);
    expect(cmd?.agent?.length).toBe(40);
    expect(cmd?.title.length).toBe(200);
  });
});

describe("isTaskCommand", () => {
  it("riflette parseTaskCommand", () => {
    expect(isTaskCommand("/task fai qualcosa")).toBe(true);
    expect(isTaskCommand("solo un messaggio")).toBe(false);
    expect(isTaskCommand("/task")).toBe(false);
  });
});
