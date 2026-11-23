import { describe, expect, it } from "vitest";
import { nextRoom, pickSeat, roomFor, ROOM_HOLD_MS } from "./roomFor";
import type { Vec2 } from "../types";

// Stanze iconiche (23/11): l'agente sta nella stanza dell'azione che sta facendo davvero.
describe("roomFor", () => {
  it("chi aspetta un'approvazione va nel Reparto revisioni, anche di notte", () => {
    expect(roomFor({ status: "awaiting_approval" }, false)).toBe("revisioni");
    expect(roomFor({ status: "awaiting_approval" }, true)).toBe("revisioni");
  });

  it("al lavoro: legge in Biblioteca, scrive in Officina, testa in Laboratorio", () => {
    expect(roomFor({ status: "working", activity: "read" }, false)).toBe("biblioteca");
    expect(roomFor({ status: "working" }, false)).toBe("biblioteca");
    expect(roomFor({ status: "working", activity: "write" }, false)).toBe("officina");
    expect(roomFor({ status: "working", activity: "test" }, false)).toBe("laboratorio");
  });

  it("al lavoro di notte resta al lavoro", () => {
    expect(roomFor({ status: "working", activity: "write" }, true)).toBe("officina");
  });

  it("bloccato resta dov'è", () => {
    expect(roomFor({ status: "blocked", activity: "write" }, false)).toBeNull();
  });

  it("libero: Salotto di giorno, Camera di notte", () => {
    for (const status of ["idle", "done", "review"] as const) {
      expect(roomFor({ status }, false)).toBe("salotto");
      expect(roomFor({ status }, true)).toBe("camera");
    }
  });

  it("finito il lavoro, la fase vecchia non conta più", () => {
    expect(roomFor({ status: "idle", activity: "write" }, false)).toBe("salotto");
  });
});

describe("nextRoom — niente corse avanti e indietro", () => {
  const since = 1_000_000;

  it("resta nella stanza finché non sono passati 20 secondi", () => {
    expect(ROOM_HOLD_MS).toBe(20_000);
    expect(nextRoom("biblioteca", "officina", since, since + 5_000, false)).toBe("biblioteca");
    expect(nextRoom("biblioteca", "officina", since, since + 25_000, false)).toBe("officina");
  });

  it("se è urgente cambia subito", () => {
    expect(nextRoom("biblioteca", "revisioni", since, since + 1_000, true)).toBe("revisioni");
  });

  it("senza una stanza di partenza va subito dove deve", () => {
    expect(nextRoom(null, "officina", since, since, false)).toBe("officina");
  });

  it("se deve restare dov'è (bloccato) non cambia", () => {
    expect(nextRoom("officina", null, since, since + 60_000, false)).toBe("officina");
  });
});

describe("pickSeat", () => {
  const seats: Vec2[] = [[0, 0], [2, 0], [4, 0], [6, 0]];

  it("prende il primo posto libero", () => {
    expect(pickSeat(seats, [])).toEqual([0, 0]);
    expect(pickSeat(seats, [[0.2, 0.1], [2, 0]])).toEqual([4, 0]);
  });

  it("se sono tutti occupati condivide il primo", () => {
    expect(pickSeat(seats, seats)).toEqual([0, 0]);
  });
});
