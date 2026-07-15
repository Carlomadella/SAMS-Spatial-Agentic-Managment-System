// Radice del sito di benvenuto: mappa il percorso corrente alla pagina, dentro il guscio
// condiviso (SiteLayout) e il provider di auth. Le route della workspace (/app) e la
// dashboard pubblica sono gestite più in alto, in App.tsx — qui vivono solo le pagine del
// sito: home, login, reset/verifica, docs, profilo (protetto) e il 404.

import { useLocation } from "./router";
import { SiteLayout } from "./SiteLayout";
import { AuthProvider, ProtectedRoute } from "./auth/AuthContext";
import { useSiteChrome } from "./useSiteChrome";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Reset } from "./pages/Reset";
import { Verify } from "./pages/Verify";
import { Docs } from "./pages/Docs";
import { Changelog } from "./pages/Changelog";
import { Profile } from "./pages/Profile";
import { NotFound } from "./pages/NotFound";

function Page({ path }: { path: string }) {
  if (path === "/") return <Home />;
  if (path === "/login") return <Login />;
  // Reset e verifica sono **pubbliche** di proposito: ci si arriva da un link monouso
  // proprio quando non si ha (o non si può avere) una sessione.
  if (path === "/reset") return <Reset />;
  if (path === "/verifica") return <Verify />;
  if (path === "/docs" || path.startsWith("/docs/")) return <Docs />;
  if (path === "/changelog") return <Changelog />;
  if (path === "/profilo")
    return (
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    );
  return <NotFound />;
}

export function SiteApp() {
  useSiteChrome();
  const { path } = useLocation();
  return (
    <AuthProvider>
      <SiteLayout>
        <Page path={path} />
      </SiteLayout>
    </AuthProvider>
  );
}
