import { describe, expect, it } from "vitest";
import { MAX_WINGS, buildLayout } from "../data/world";
import { clampTarget, followTransition, smoothFactor, isSceneKeyTarget, isTypingTarget, keyToAction, movedBeyond, roomShortcuts } from "./viewNav";

const B = { minX: -10, maxX: 10, minZ: -8, maxZ: 8 };

describe("clampTarget", () => {
  it("riporta dentro un punto oltre il bordo sinistro", () => {
    expect(clampTarget(-50, 3, B)).toEqual([-10, 3]);
  });
  it("riporta dentro un punto oltre il bordo davanti", () => {
    expect(clampTarget(2, 20, B)).toEqual([2, 8]);
  });
  it("lascia invariato un punto interno", () => {
    expect(clampTarget(1, -2, B)).toEqual([1, -2]);
  });
});

describe("roomShortcuts", () => {
  it("ordina le stanze della casa base da sinistra a destra, dietro prima", () => {
    const rooms = roomShortcuts(buildLayout(0));
    expect(rooms.map((r) => r.id)).toEqual(["revisioni", "studio", "salotto", "cucina", "camera"]);
    const studio = rooms.find((r) => r.id === "studio")!;
    expect(studio.x).toBeCloseTo(-6.6);
    expect(studio.z).toBeCloseTo(-4.6);
  });
  it("non supera nove stanze anche con tutte le ali", () => {
    expect(roomShortcuts(buildLayout(MAX_WINGS)).length).toBeLessThanOrEqual(9);
  });
});

describe("keyToAction", () => {
  it("W maiuscola sposta in avanti", () => {
    expect(keyToAction("W")).toEqual({ kind: "move", dir: "forward" });
  });
  it("freccia sinistra sposta a sinistra", () => {
    expect(keyToAction("ArrowLeft")).toEqual({ kind: "move", dir: "left" });
  });
  it("3 porta alla terza stanza", () => {
    expect(keyToAction("3")).toEqual({ kind: "room", index: 2 });
  });
  it("Q ed E ruotano in versi opposti", () => {
    expect(keyToAction("q")).toEqual({ kind: "rotate", dir: -1 });
    expect(keyToAction("e")).toEqual({ kind: "rotate", dir: 1 });
  });
  it("+ avvicina e - allontana", () => {
    expect(keyToAction("+")).toEqual({ kind: "zoom", dir: -1 });
    expect(keyToAction("-")).toEqual({ kind: "zoom", dir: 1 });
  });
  it("H e F sono vista intera e segui", () => {
    expect(keyToAction("h")).toEqual({ kind: "home" });
    expect(keyToAction("f")).toEqual({ kind: "follow" });
  });
  it("0 e tasti non gestiti non fanno niente", () => {
    expect(keyToAction("0")).toBeNull();
    expect(keyToAction("x")).toBeNull();
    expect(keyToAction("Tab")).toBeNull();
  });
});

describe("isTypingTarget", () => {
  it("riconosce i campi di testo", () => {
    expect(isTypingTarget(document.createElement("input"))).toBe(true);
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    expect(isTypingTarget(document.createElement("select"))).toBe(true);
    const ed = document.createElement("div");
    ed.setAttribute("contenteditable", "true");
    expect(isTypingTarget(ed)).toBe(true);
  });
  it("ignora un div normale e l'assenza di bersaglio", () => {
    expect(isTypingTarget(document.createElement("div"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("movedBeyond", () => {
  it("un clic fermo non è un trascinamento", () => {
    expect(movedBeyond(100, 100, 103, 102)).toBe(false);
  });
  it("oltre 6 pixel è un trascinamento", () => {
    expect(movedBeyond(100, 100, 107, 100)).toBe(true);
  });
});

describe("isSceneKeyTarget", () => {
  it("i tasti valgono per la scena se il focus è sulla pagina o sulla tela 3D", () => {
    expect(isSceneKeyTarget(document.body)).toBe(true);
    expect(isSceneKeyTarget(document.createElement("canvas"))).toBe(true);
    expect(isSceneKeyTarget(null)).toBe(true);
  });
  it("non valgono se il focus è su un pulsante, un pannello o un campo", () => {
    expect(isSceneKeyTarget(document.createElement("button"))).toBe(false);
    expect(isSceneKeyTarget(document.createElement("div"))).toBe(false);
    expect(isSceneKeyTarget(document.createElement("input"))).toBe(false);
  });
});

describe("followTransition", () => {
  it("selezionare un agente avvia il volo verso di lui", () => {
    expect(followTransition({ selected: null, follow: false }, { selected: "a", follow: true })).toBe(true);
  });
  it("riagganciare il segui avvia il volo", () => {
    expect(followTransition({ selected: "a", follow: false }, { selected: "a", follow: true })).toBe(true);
  });
  it("deselezionare mentre si segue riporta al centro", () => {
    expect(followTransition({ selected: "a", follow: true }, { selected: null, follow: false })).toBe(true);
  });
  it("deselezionare dopo aver spostato la visuale a mano la lascia dov'è", () => {
    expect(followTransition({ selected: "a", follow: false }, { selected: null, follow: false })).toBe(false);
  });
  it("nessun cambio, nessun volo", () => {
    expect(followTransition({ selected: "a", follow: true }, { selected: "a", follow: true })).toBe(false);
  });
});

describe("smoothFactor", () => {
  it("a 60 fps vale circa 0,12 come prima", () => {
    expect(smoothFactor(1 / 60)).toBeCloseTo(0.12, 2);
  });
  it("due fotogrammi a 120 fps avanzano quanto uno a 60 fps", () => {
    const half = smoothFactor(1 / 120);
    expect(1 - (1 - half) ** 2).toBeCloseTo(smoothFactor(1 / 60), 10);
  });
});
