import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useDesign } from "../design/DesignContext";

/**
 * Toggle chiaro/scuro del sito. Riusa la stessa meccanica dell'app: la classe
 * `theme-light` su <html> (che rimappa i token colore in index.css) e la chiave
 * persistita `sams.theme`. Auto-contenuto: è l'unico a scrivere il tema, quindi non
 * serve uno stato condiviso — la classe è globale e l'intero sito la riflette.
 *
 * Se mostrarsi come sola icona o con l'etichetta è una variante di design (vedi /design);
 * `variant` esplicito serve alle anteprime del lab.
 */
export function ThemeToggle({ className = "", variant }: { className?: string; variant?: string }) {
  const { choice } = useDesign();
  const withLabel = (variant ?? choice("themeToggle")) === "etichetta";
  const [light, setLight] = useState(() => {
    try {
      return localStorage.getItem("sams.theme") === "light";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("theme-light", light);
    try {
      localStorage.setItem("sams.theme", light ? "light" : "dark");
    } catch {
      /* ignore */
    }
  }, [light]);

  return (
    <button
      type="button"
      onClick={() => setLight((v) => !v)}
      aria-label={light ? "Passa al tema scuro" : "Passa al tema chiaro"}
      title={light ? "Tema scuro" : "Tema chiaro"}
      className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-ink-800/40 text-slate-300 transition-colors hover:border-brand/50 hover:text-white ${
        withLabel ? "px-3" : "w-9"
      } ${className}`}
    >
      {light ? <Moon size={16} /> : <Sun size={16} />}
      {withLabel && <span className="text-xs font-medium">{light ? "Scuro" : "Chiaro"}</span>}
    </button>
  );
}
