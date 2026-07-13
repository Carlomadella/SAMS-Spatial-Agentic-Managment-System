// Router interno leggero (zero dipendenze) per il sito di benvenuto. Usa la History
// API con URL puliti: il server ha già il fallback SPA (serve index.html sulle route
// sconosciute — vedi server.ts) e Vite fa lo stesso in dev, quindi i deep-link come
// /login o /docs funzionano anche ricaricando la pagina. Espone il minimo indispensabile:
// un provider, gli hook useLocation/useNavigate e un componente <Link> che intercetta i
// click interni (lasciando passare tab nuove, link esterni, ancore e modificatori).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

interface RouterValue {
  path: string;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

/**
 * Normalizza un percorso: toglie l'eventuale slash finale (tranne la root) così
 * "/docs" e "/docs/" combaciano nel matching. Puro e testabile.
 */
export function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname || "/";
}

function currentPath(): string {
  return normalizePath(window.location.pathname);
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    // Back/forward del browser → riallinea lo stato al percorso corrente.
    const onPop = () => setPath(currentPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    if (opts?.replace) window.history.replaceState(null, "", to);
    else window.history.pushState(null, "", to);
    setPath(currentPath());
    // Ancora (#id): dopo il render della pagina di destinazione scrolla all'elemento;
    // altrimenti riparti dall'alto. rAF così l'elemento esiste già nel DOM.
    const hashIdx = to.indexOf("#");
    if (hashIdx >= 0) {
      const id = to.slice(hashIdx + 1);
      requestAnimationFrame(() => {
        const el = id ? document.getElementById(id) : null;
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        else window.scrollTo(0, 0);
      });
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  return <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>;
}

function useRouter(): RouterValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter deve stare dentro <RouterProvider>");
  return ctx;
}

/** Percorso corrente (già normalizzato). */
export function useLocation(): { path: string } {
  return { path: useRouter().path };
}

/** Naviga via History API senza ricaricare la pagina. */
export function useNavigate(): RouterValue["navigate"] {
  return useRouter().navigate;
}

type LinkProps = { to: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

/**
 * Link interno: naviga senza reload sui click "semplici" (tasto sinistro, nessun
 * modificatore) verso percorsi dell'app; lascia il comportamento nativo del browser
 * per link esterni (http/mailto), ancore (#...), click col Cmd/Ctrl (nuova scheda),
 * o target esplicito — così "apri in nuova scheda" e le ancore continuano a funzionare.
 */
export function Link({ to, onClick, ...rest }: LinkProps) {
  const navigate = useNavigate();

  const isExternal = /^(https?:)?\/\//.test(to) || to.startsWith("mailto:") || to.startsWith("#");

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (isExternal) return; // ancore e link esterni → comportamento nativo
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // nuova scheda ecc.
    if (rest.target && rest.target !== "_self") return;
    e.preventDefault();
    navigate(to);
  }

  return <a href={to} onClick={handleClick} {...rest} />;
}
