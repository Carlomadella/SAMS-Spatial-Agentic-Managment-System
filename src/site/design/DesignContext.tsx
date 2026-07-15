// Le scelte di design del sito (Roadmap 5) in un posto solo: palette, navbar, hero e la
// forma dei componenti condivisi (logo, bottoni, footer, testate, container, toggle tema).
//
// Vive in un contesto e non in un hook per componente perché le varianti si scelgono da
// /design ma si **vedono** altrove (la navbar è nel layout, la hero in home, il logo
// ovunque). Senza uno stato condiviso, cambiare palette dal lab non aggiornerebbe la navbar
// sopra di esso finché non si ricarica — cioè il confronto, che è tutto il punto, non si
// potrebbe fare.
//
// Le scelte sono un **dizionario** e non nove campi: aggiungere una variante nuova non deve
// costringere a toccare il contesto, il lab e i test. Ognuna è persistita e ortogonale alle
// altre (e al tema chiaro/scuro, che resta del ThemeToggle): le combinazioni si provano tutte.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_HERO_ID, heroById } from "../data/heroVariants";
import { DEFAULT_NAVBAR_ID, navbarById } from "../data/navbarVariants";
import { DEFAULT_PALETTE_ID, paletteById } from "../data/palettes";
import { VARIANTS, choiceById, firstId, type DesignKey } from "../data/componentVariants";
import { applyPalette } from "./applyPalette";

type Choices = Record<DesignKey, string>;

const STORAGE_PREFIX = "sams.site.";

/** I default: la combinazione scelta per il sito. */
function defaults(): Choices {
  return {
    palette: DEFAULT_PALETTE_ID,
    navbar: DEFAULT_NAVBAR_ID,
    hero: DEFAULT_HERO_ID,
    logo: firstId(VARIANTS.logo),
    button: firstId(VARIANTS.button),
    footer: firstId(VARIANTS.footer),
    heading: firstId(VARIANTS.heading),
    container: firstId(VARIANTS.container),
    themeToggle: firstId(VARIANTS.themeToggle),
  };
}

/**
 * Normalizza un id letto da localStorage: uno sconosciuto (versione vecchia, o valore
 * manomesso a mano) ricade sul default invece di lasciare il sito senza palette o con un
 * componente che non sa cosa rendere.
 */
function normalize(key: DesignKey, id: string | null): string {
  if (key === "palette") return paletteById(id).id;
  if (key === "navbar") return navbarById(id).id;
  if (key === "hero") return heroById(id).id;
  return choiceById(VARIANTS[key], id).id;
}

function readChoices(): Choices {
  const base = defaults();
  const out = { ...base };
  for (const key of Object.keys(base) as DesignKey[]) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_PREFIX + key);
    } catch {
      /* localStorage non disponibile → restano i default */
    }
    out[key] = normalize(key, raw);
  }
  return out;
}

interface DesignValue {
  choices: Choices;
  /** L'id scelto per una chiave (già normalizzato). */
  choice: (key: DesignKey) => string;
  set: (key: DesignKey, id: string) => void;
  /** Rimette tutte le scelte alla combinazione del sito. */
  reset: () => void;
}

const DesignContext = createContext<DesignValue | null>(null);

export function DesignProvider({ children }: { children: ReactNode }) {
  const [choices, setChoices] = useState<Choices>(readChoices);

  // La palette è l'unica che tocca il documento: inietta le sue regole (vedi applyPalette).
  useEffect(() => {
    applyPalette(choices.palette);
  }, [choices.palette]);

  useEffect(() => {
    try {
      for (const [key, id] of Object.entries(choices)) localStorage.setItem(STORAGE_PREFIX + key, id);
    } catch {
      /* localStorage non disponibile → le scelte valgono per questa sessione */
    }
  }, [choices]);

  const set = useCallback((key: DesignKey, id: string) => {
    setChoices((c) => ({ ...c, [key]: normalize(key, id) }));
  }, []);
  const reset = useCallback(() => setChoices(defaults()), []);
  const choice = useCallback((key: DesignKey) => choices[key], [choices]);

  const value = useMemo(() => ({ choices, choice, set, reset }), [choices, choice, set, reset]);
  return <DesignContext.Provider value={value}>{children}</DesignContext.Provider>;
}

/** Valore usato fuori dal provider: i default, e le scelte non si possono cambiare. */
const STANDALONE: DesignValue = {
  choices: defaults(),
  choice: (key) => defaults()[key],
  set: () => {},
  reset: () => {},
};

/**
 * Le scelte di design correnti. **Non lancia** fuori dal provider: ricade sui default.
 *
 * È deliberato. Logo, Container e CTAButton sono componenti foglia riusabili, e pretendere
 * un provider li legherebbe al guscio del sito — un test che monta il solo bottone, o un
 * riuso altrove, si romperebbero senza motivo. Il costo è che un provider dimenticato non
 * urla; lo coprono i test e2e, che verificano che le scelte del lab arrivino davvero al sito.
 */
export function useDesign(): DesignValue {
  return useContext(DesignContext) ?? STANDALONE;
}
