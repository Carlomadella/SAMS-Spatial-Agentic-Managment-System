import { useEffect } from "react";

/**
 * "Chrome" del sito: applica il tema persistito (`sams.theme`, la stessa chiave dell'app)
 * al montaggio, così un reload su una pagina del sito rispetta la scelta chiaro/scuro
 * anche prima che il ThemeToggle si monti. Lo scroll del sito è gestito dal contenitore
 * di SiteLayout (`overflow-y-auto`), non dal body, così non tocchiamo l'`overflow:hidden`
 * globale pensato per la workspace a schermo intero.
 */
export function useSiteChrome() {
  useEffect(() => {
    let light = false;
    try {
      light = localStorage.getItem("sams.theme") === "light";
    } catch {
      /* ignore */
    }
    document.documentElement.classList.toggle("theme-light", light);
  }, []);

  // La palette (Roadmap 5) la applica il `DesignProvider`, che avvolge tutto il sito:
  // vale quindi su ogni pagina, non solo dove si sceglie.

  // Riabilita lo scroll del documento solo mentre il sito è montato: l'app in
  // `body { overflow: hidden }` è a schermo intero, il sito invece scorre. La classe
  // viene rimossa allo smontaggio (es. entrando nella workspace /app).
  useEffect(() => {
    document.body.classList.add("site-scroll");
    // se l'URL iniziale ha un'ancora (deep-link tipo /#prezzi), portacisi dopo il render
    const hash = window.location.hash.slice(1);
    if (hash) {
      requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }));
    }
    return () => document.body.classList.remove("site-scroll");
  }, []);
}
