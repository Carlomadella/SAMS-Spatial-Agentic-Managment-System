import type { ReactNode } from "react";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";

/**
 * Guscio condiviso delle pagine del sito: Navbar (sticky) + contenuto della pagina +
 * Footer. È l'equivalente di un layout con <Outlet/>: SiteApp gli passa la pagina
 * corrente come children. Non è un contenitore di scroll — il sito scorre a livello di
 * documento (vedi useSiteChrome/index.css), così ancore e sticky si comportano nativamente.
 */
export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-slate-200">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
