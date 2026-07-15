// Varianti della navbar (Roadmap 5) — la richiesta era vederle *affiancate* per capire cosa
// cambia: una completa (5 link + 2 CTA oltre ad Accedi/Profilo) e altre che tolgono ogni
// volta un pezzo diverso, così il confronto isola una variabile per volta.
//
// Sono **dati, non componenti**: la `Navbar` è una sola e si configura. Quattro copie del
// markup divergerebbero al primo ritocco — e la domanda da rispondere qui è "quanti link e
// quante CTA", non "che struttura".

import { GITHUB_URL, type NavLink } from "./site";

export interface NavbarVariant {
  id: string;
  name: string;
  /** Cosa mette alla prova questa variante, in una riga (mostrata nel design lab). */
  blurb: string;
  links: NavLink[];
  /** Toggle chiaro/scuro tra le azioni a destra. */
  theme: boolean;
  /** CTA primaria "Apri la stanza". */
  roomCta: boolean;
  /** Accedi / Profilo. Sempre presente: è il modo di entrare. */
  auth: true;
}

const FEATURES: NavLink = { label: "Funzionalità", to: "/#funzionalita" };
const DOCS: NavLink = { label: "Docs", to: "/docs" };
const GITHUB: NavLink = { label: "GitHub", to: GITHUB_URL, external: true };
const PRICING: NavLink = { label: "Prezzi", to: "/#prezzi" };
const CONTACT: NavLink = { label: "Contatti", to: "/#site-footer" };

export const NAVBAR_VARIANTS: NavbarVariant[] = [
  {
    id: "completa",
    name: "Completa — 5 link, 2 CTA",
    blurb: "Tutto in vista: i cinque link e, a destra, tema + «Apri la stanza» + Accedi. Nulla è nascosto, ma a 1280px respira poco.",
    links: [FEATURES, DOCS, GITHUB, PRICING, CONTACT],
    theme: true,
    roomCta: true,
    auth: true,
  },
  {
    id: "senza-github",
    name: "Un link in meno — senza GitHub",
    blurb: "Come la completa, ma GitHub resta solo nel footer: quattro link centrali respirano di più e il codice non compete con «Prezzi».",
    links: [FEATURES, DOCS, PRICING, CONTACT],
    theme: true,
    roomCta: true,
    auth: true,
  },
  {
    id: "senza-tema",
    name: "Una CTA in meno — senza toggle tema",
    blurb: "Cinque link, ma il tema scende nel footer: a destra restano due soli bottoni e la CTA principale si nota molto di più.",
    links: [FEATURES, DOCS, GITHUB, PRICING, CONTACT],
    theme: false,
    roomCta: true,
    auth: true,
  },
  {
    id: "minima",
    name: "Minima — 3 link, solo Accedi",
    blurb: "Tolto anche «Apri la stanza»: l'unica via d'ingresso è Accedi. La più pulita, ma chi è già registrato fa un click in più.",
    links: [FEATURES, DOCS, PRICING],
    theme: true,
    roomCta: false,
    auth: true,
  },
];

export const DEFAULT_NAVBAR_ID = "completa";

/** Cerca una variante per id; ricade sul default per un id sconosciuto. */
export function navbarById(id: string | null | undefined): NavbarVariant {
  return NAVBAR_VARIANTS.find((v) => v.id === id) ?? NAVBAR_VARIANTS.find((v) => v.id === DEFAULT_NAVBAR_ID)!;
}
