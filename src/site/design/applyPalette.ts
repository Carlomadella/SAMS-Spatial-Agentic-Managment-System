import { paletteById, paletteCss } from "../data/palettes";

const STYLE_ID = "sams-site-palette";

/**
 * Applica una palette iniettando le sue regole in un <style> in coda al <head> (Roadmap 5).
 *
 * Perché iniettare CSS invece di scrivere le variabili sul body: così **chiaro/scuro resta
 * gestito dal CSS** come nel resto del sito (la regola `.theme-light body.site-scroll` fa
 * il suo lavoro da sola) e non serve un observer che insegua il ThemeToggle. A pari
 * specificità con `index.css`, vince perché arriva dopo.
 *
 * Un solo tag riusato per id: cambiare palette ne riscrive il contenuto, invece di
 * impilare regole morte a ogni scelta.
 */
export function applyPalette(id: string): void {
  const css = paletteCss(paletteById(id));
  let tag = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = STYLE_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = css;
}
