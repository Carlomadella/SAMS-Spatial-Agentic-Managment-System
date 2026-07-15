import { describe, expect, it } from "vitest";
import { DEFAULT_NAVBAR_ID, NAVBAR_VARIANTS, navbarById } from "./navbarVariants";
import { DEFAULT_HERO_ID, HERO_VARIANTS, heroById } from "./heroVariants";
import { VARIANTS, choiceById, firstId } from "./componentVariants";

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

  it("il default è il video della stanza (scelto dal lab)", () => {
    expect(DEFAULT_HERO_ID).toBe("video");
  });

  it("ricade sul default per id sconosciuto o assente", () => {
    expect(heroById("boh").id).toBe(DEFAULT_HERO_ID);
    expect(heroById(null).id).toBe(DEFAULT_HERO_ID);
    expect(heroById(undefined).id).toBe(DEFAULT_HERO_ID);
  });
});

// --- varianti dei componenti condivisi (Roadmap 5) -------------------------

describe("varianti dei componenti condivisi", () => {
  it("ogni gruppo ha almeno due opzioni: una sola non è una scelta", () => {
    for (const [key, list] of Object.entries(VARIANTS)) {
      expect(list.length, key).toBeGreaterThanOrEqual(2);
    }
  });

  it("gli id sono unici dentro ogni gruppo", () => {
    for (const [key, list] of Object.entries(VARIANTS)) {
      expect(new Set(list.map((c) => c.id)).size, key).toBe(list.length);
    }
  });

  it("ogni opzione si spiega: nome e blurb non sono segnaposto", () => {
    for (const [key, list] of Object.entries(VARIANTS)) {
      for (const c of list) {
        expect(c.name.length, `${key}.${c.id}`).toBeGreaterThan(2);
        expect(c.blurb.length, `${key}.${c.id}`).toBeGreaterThan(20);
      }
    }
  });

  it("copre i componenti condivisi che hanno un aspetto da scegliere", () => {
    // SiteLayout è la somma di Navbar/Footer/Container; AuthContext/ProtectedRoute
    // sono logica di sessione: nessuno dei due ha una forma da variare.
    expect(Object.keys(VARIANTS).sort()).toEqual(
      ["button", "container", "footer", "heading", "logo", "themeToggle"].sort(),
    );
  });

  it("firstId dà il default (la variante scelta per il sito)", () => {
    expect(firstId(VARIANTS.logo)).toBe("orbitale");
    expect(firstId(VARIANTS.button)).toBe("arrotondato");
    expect(firstId(VARIANTS.footer)).toBe("completo");
  });

  it("choiceById ricade sulla prima per id sconosciuto, vuoto o assente", () => {
    expect(choiceById(VARIANTS.button, "inventata").id).toBe("arrotondato");
    expect(choiceById(VARIANTS.button, "").id).toBe("arrotondato");
    expect(choiceById(VARIANTS.button, null).id).toBe("arrotondato");
    expect(choiceById(VARIANTS.button, undefined).id).toBe("arrotondato");
  });

  it("choiceById trova la variante giusta quando l'id è valido", () => {
    expect(choiceById(VARIANTS.logo, "punto").name).toBe("Punto");
  });
});
