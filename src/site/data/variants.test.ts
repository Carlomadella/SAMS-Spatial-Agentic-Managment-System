import { describe, expect, it } from "vitest";
import { DEFAULT_NAVBAR_ID, NAVBAR_VARIANTS, navbarById } from "./navbarVariants";
import { DEFAULT_HERO_ID, HERO_VARIANTS, heroById } from "./heroVariants";

describe("NAVBAR_VARIANTS", () => {
  it("gli id sono unici", () => {
    expect(new Set(NAVBAR_VARIANTS.map((v) => v.id)).size).toBe(NAVBAR_VARIANTS.length);
  });

  it("la variante completa ha i 5 link e le 2 CTA chieste dalla roadmap", () => {
    const completa = navbarById("completa");
    expect(completa.links).toHaveLength(5);
    expect(completa.links.map((l) => l.label)).toEqual(["Funzionalità", "Docs", "GitHub", "Prezzi", "Contatti"]);
    expect(completa.theme).toBe(true); // CTA 1: toggle tema
    expect(completa.roomCta).toBe(true); // CTA 2: apri la stanza
  });

  it("ogni altra variante toglie qualcosa di diverso (il confronto isola una variabile)", () => {
    const completa = navbarById("completa");
    const others = NAVBAR_VARIANTS.filter((v) => v.id !== "completa");
    for (const v of others) {
      const lessLinks = v.links.length < completa.links.length;
      const lessCtas = Number(v.theme) + Number(v.roomCta) < Number(completa.theme) + Number(completa.roomCta);
      expect(lessLinks || lessCtas, `${v.id} deve togliere qualcosa`).toBe(true);
    }
  });

  it("Accedi/Profilo non si toglie mai: è il modo di entrare", () => {
    for (const v of NAVBAR_VARIANTS) expect(v.auth).toBe(true);
  });

  it("ogni variante ha almeno un link e un nome descrittivo", () => {
    for (const v of NAVBAR_VARIANTS) {
      expect(v.links.length, v.id).toBeGreaterThan(0);
      expect(v.name.length, v.id).toBeGreaterThan(3);
      expect(v.blurb.length, v.id).toBeGreaterThan(10);
    }
  });

  it("nessun link duplicato dentro una variante", () => {
    for (const v of NAVBAR_VARIANTS) {
      expect(new Set(v.links.map((l) => l.label)).size, v.id).toBe(v.links.length);
    }
  });

  it("ricade sul default per id sconosciuto o assente", () => {
    expect(navbarById("boh").id).toBe(DEFAULT_NAVBAR_ID);
    expect(navbarById(null).id).toBe(DEFAULT_NAVBAR_ID);
    expect(navbarById(undefined).id).toBe(DEFAULT_NAVBAR_ID);
  });
});

describe("HERO_VARIANTS", () => {
  it("gli id sono unici", () => {
    expect(new Set(HERO_VARIANTS.map((v) => v.id)).size).toBe(HERO_VARIANTS.length);
  });

  it("ci sono sia lo screenshot sia il video, e più opzioni senza la stanza", () => {
    const ids = HERO_VARIANTS.map((v) => v.id);
    expect(ids).toContain("immagine");
    expect(ids).toContain("video");
    // "tante varianti, non solo una con bg-image e una con bg-video"
    expect(ids.filter((i) => i !== "immagine" && i !== "video").length).toBeGreaterThanOrEqual(2);
  });

  it("ogni variante dichiara il suo compromesso (il lab non deve nasconderlo)", () => {
    for (const v of HERO_VARIANTS) {
      expect(v.tradeoff.length, v.id).toBeGreaterThan(20);
      expect(v.blurb.length, v.id).toBeGreaterThan(10);
    }
  });

  it("il default è lo screenshot (il look attuale)", () => {
    expect(DEFAULT_HERO_ID).toBe("immagine");
  });

  it("ricade sul default per id sconosciuto o assente", () => {
    expect(heroById("boh").id).toBe(DEFAULT_HERO_ID);
    expect(heroById(null).id).toBe(DEFAULT_HERO_ID);
    expect(heroById(undefined).id).toBe(DEFAULT_HERO_ID);
  });
});
