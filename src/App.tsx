import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { RouterProvider, useLocation } from "./site/router";
import { SiteApp } from "./site/SiteApp";

// Radice dell'app: decide solo **quale** parte mostrare. Il sito di benvenuto è caricato
// subito (è la prima cosa che vede chi arriva); la workspace 3D e la dashboard pubblica
// sono pezzi a parte, scaricati solo quando servono. Così la home non si porta dietro
// pannelli, bridge e logica della stanza.
const Workspace = lazy(() => import("./Workspace"));
const PublicDashboard = lazy(() =>
  import("./components/PublicDashboard").then((m) => ({ default: m.PublicDashboard })),
);

function ViewLoading({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="fixed inset-0 flex flex-col items-center justify-center gap-2 bg-[#eef2f7] text-slate-500"
    >
      <Loader2 size={22} className="animate-spin" aria-hidden />
      <span className="text-[12px]">{label}</span>
    </div>
  );
}

/** Read the `?public` flag once at module load — it never changes within a session. */
const IS_PUBLIC = new URLSearchParams(window.location.search).has("public");

export default function App() {
  // Shareable read-only dashboard: a separate, self-contained view that doesn't
  // mount the workspace (no SSE, no scene, no controls).
  if (IS_PUBLIC)
    return (
      <Suspense fallback={<ViewLoading label="Caricamento dashboard…" />}>
        <PublicDashboard />
      </Suspense>
    );
  // Altrimenti il router interno leggero decide: la workspace 3D vive su /app, il resto
  // (/, /login, /docs, /profilo) è il sito di benvenuto.
  return (
    <RouterProvider>
      <RootRoutes />
    </RouterProvider>
  );
}

/** Route di primo livello: la stanza (workspace) su /app, il sito su tutto il resto. */
function RootRoutes() {
  const { path } = useLocation();
  if (path === "/app" || path.startsWith("/app/"))
    return (
      <Suspense fallback={<ViewLoading label="Caricamento della stanza…" />}>
        <Workspace />
      </Suspense>
    );
  return <SiteApp />;
}
