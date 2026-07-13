// Auth *mock* per il sito (Roadmap 5): nessun backend, solo uno stato utente
// persistito in localStorage così "Accedi/Profilo" e le route protette funzionano
// end-to-end. L'auth reale è rimandata alla Roadmap 4 (vedi ROADMAP5.md) — questo
// contratto (user/login/logout) è pensato per essere rimpiazzato senza toccare la UI.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "../router";

export interface SiteUser {
  name: string;
  email: string;
}

interface AuthValue {
  user: SiteUser | null;
  login: (email: string, name?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);
const STORAGE_KEY = "sams.site.auth";

/** Deriva un nome leggibile dalla parte locale dell'email (mock). */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0] || "utente";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function readStored(): SiteUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (u && typeof u.email === "string") return { name: String(u.name ?? nameFromEmail(u.email)), email: u.email };
  } catch {
    /* localStorage non disponibile o JSON rotto → nessun utente */
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SiteUser | null>(readStored);

  const login = useCallback((email: string, name?: string) => {
    const u: SiteUser = { email: email.trim(), name: (name?.trim() || nameFromEmail(email)) };
    setUser(u);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } catch {
      /* ignore */
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve stare dentro <AuthProvider>");
  return ctx;
}

/**
 * Guardia di route: se non c'è un utente, reindirizza a /login (replace, così il back
 * non rimbalza sulla pagina protetta). Finché il redirect non è avvenuto non renderizza
 * nulla. Usata per /profilo; pronta per qualunque pagina riservata futura.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) navigate("/login", { replace: true });
  }, [user, navigate]);
  if (!user) return null;
  return <>{children}</>;
}
