import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Toggle chiaro/scuro del sito. Riusa la stessa meccanica dell'app: la classe
 * `theme-light` su <html> (che rimappa i token colore in index.css) e la chiave
 * persistita `sams.theme`. Auto-contenuto: è l'unico a scrivere il tema, quindi non
 * serve uno stato condiviso — la classe è globale e l'intero sito la riflette.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
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
      className={`flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-ink-800/40 text-slate-300 transition-colors hover:border-brand/50 hover:text-white ${className}`}
    >
      {light ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
