// Auth del sito (Roadmap 4, frontiera #3) — ora **reale**: account veri sul runtime
// (users/sessions in SQLite, hashing scrypt) al posto del mock in localStorage. Il
// client conserva solo il **token di sessione** (bearer) e ricava l'utente da
// `GET /api/auth/me`; login/register/logout parlano con `/api/auth/*`. Il contratto
// (user/login/register/logout) è pensato per non toccare la UI.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BASE } from "../../lib/backend";
import { useNavigate } from "../router";

export type SiteRole = "owner" | "editor" | "viewer";

export interface SiteUser {
  name: string;
  email: string;
  role: SiteRole;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
}

interface AuthValue {
  user: SiteUser | null;
  /** true finché il primo `GET /me` (ripristino sessione) non è concluso. */
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, password: string, name?: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);
const TOKEN_KEY = "sams.site.token";

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* localStorage non disponibile → sessione solo in memoria */
  }
}

/** Estrae il messaggio d'errore dal corpo JSON di una risposta non-ok. */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SiteUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Ripristino sessione all'avvio: se c'è un token, chiedi chi sono.
  useEffect(() => {
    const token = readToken();
    if (!token) {
      setLoading(false);
      return;
    }
    let alive = true;
    void fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!alive) return;
        if (res.ok) {
          const body = (await res.json()) as { user: SiteUser };
          setUser(body.user);
        } else {
          writeToken(""); // token scaduto/invalido
        }
      })
      .catch(() => {
        /* runtime irraggiungibile → resta sloggato, il token si ritenta al prossimo avvio */
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const authenticate = useCallback(
    async (path: "login" | "register", payload: Record<string, string>): Promise<AuthResult> => {
      let res: Response;
      try {
        res = await fetch(`${BASE}/api/auth/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        return { ok: false, error: "Runtime non raggiungibile — avvia il server con npm start." };
      }
      if (!res.ok) return { ok: false, error: await errorMessage(res, "Accesso non riuscito") };
      const body = (await res.json()) as { token: string; user: SiteUser };
      writeToken(body.token);
      setUser(body.user);
      return { ok: true };
    },
    [],
  );

  const login = useCallback(
    (email: string, password: string) => authenticate("login", { email, password }),
    [authenticate],
  );

  const register = useCallback(
    (email: string, password: string, name?: string) =>
      authenticate("register", { email, password, ...(name ? { name } : {}) }),
    [authenticate],
  );

  const logout = useCallback(async () => {
    const token = readToken();
    writeToken("");
    setUser(null);
    if (!token) return;
    try {
      await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    } catch {
      /* la sessione locale è già chiusa; quella server scadrà da sola */
    }
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve stare dentro <AuthProvider>");
  return ctx;
}

/**
 * Guardia di route: se non c'è un utente (e non stiamo ancora ripristinando la
 * sessione), reindirizza a /login. Durante il caricamento non renderizza nulla —
 * evita un rimbalzo su /login mentre `GET /me` è in corso.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);
  if (loading || !user) return null;
  return <>{children}</>;
}
