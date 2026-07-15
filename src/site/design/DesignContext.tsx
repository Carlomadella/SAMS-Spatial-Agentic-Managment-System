// Le scelte di design del sito (Roadmap 5), in un posto solo: palette, variante di navbar,
// variante di hero. Vive in un contesto e non in tre hook separati per una ragione precisa:
// le varianti si scelgono da /design ma si **vedono** altrove (la navbar è nel layout, la
// hero è in home). Senza uno stato condiviso, cambiare palette dal lab non aggiornerebbe la
// navbar sopra di esso finché non si ricarica — cioè il confronto, che è tutto il punto,
// non si potrebbe fare.
//
// Ogni scelta è persistita e ortogonale alle altre (e al tema chiaro/scuro, che resta del
// ThemeToggle): le combinazioni si provano tutte.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_HERO_ID, heroById, type HeroKind } from "../data/heroVariants";
import { DEFAULT_NAVBAR_ID, navbarById } from "../data/navbarVariants";
import { DEFAULT_PALETTE_ID, paletteById } from "../data/palettes";
import { applyPalette } from "./applyPalette";

const NAVBAR_KEY = "sams.site.navbar";
const HERO_KEY = "sams.site.hero";
const PALETTE_KEY = "sams.site.palette";

interface DesignValue {
  paletteId: string;
  navbarId: string;
  heroId: HeroKind;
  setPalette: (id: string) => void;
  setNavbar: (id: string) => void;
  setHero: (id: string) => void;
  /** Rimette le tre scelte ai valori di partenza. */
  reset: () => void;
}

const DesignContext = createContext<DesignValue | null>(null);

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* localStorage non disponibile → la scelta vale per questa sessione */
  }
}

export function DesignProvider({ children }: { children: ReactNode }) {
  // Gli id passano sempre per `*ById`: un valore vecchio o manomesso in localStorage
  // ricade sul default invece di lasciare il sito senza palette.
  const [paletteId, setPaletteId] = useState(() => paletteById(read(PALETTE_KEY, DEFAULT_PALETTE_ID)).id);
  const [navbarId, setNavbarId] = useState(() => navbarById(read(NAVBAR_KEY, DEFAULT_NAVBAR_ID)).id);
  const [heroId, setHeroId] = useState<HeroKind>(() => heroById(read(HERO_KEY, DEFAULT_HERO_ID)).id);

  useEffect(() => {
    applyPalette(paletteId);
    write(PALETTE_KEY, paletteId);
  }, [paletteId]);
  useEffect(() => write(NAVBAR_KEY, navbarId), [navbarId]);
  useEffect(() => write(HERO_KEY, heroId), [heroId]);

  const setPalette = useCallback((id: string) => setPaletteId(paletteById(id).id), []);
  const setNavbar = useCallback((id: string) => setNavbarId(navbarById(id).id), []);
  const setHero = useCallback((id: string) => setHeroId(heroById(id).id), []);
  const reset = useCallback(() => {
    setPaletteId(DEFAULT_PALETTE_ID);
    setNavbarId(DEFAULT_NAVBAR_ID);
    setHeroId(DEFAULT_HERO_ID);
  }, []);

  const value = useMemo(
    () => ({ paletteId, navbarId, heroId, setPalette, setNavbar, setHero, reset }),
    [paletteId, navbarId, heroId, setPalette, setNavbar, setHero, reset],
  );
  return <DesignContext.Provider value={value}>{children}</DesignContext.Provider>;
}

export function useDesign(): DesignValue {
  const ctx = useContext(DesignContext);
  if (!ctx) throw new Error("useDesign deve stare dentro <DesignProvider>");
  return ctx;
}
