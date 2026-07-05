import { useStore } from "../store/useStore";

// Registers the service worker that makes SAMS an installable, offline-capable
// PWA. Only runs in a production build (never during `vite dev`, where a cached
// shell would fight HMR) and only when the browser supports service workers.
//
// It also watches for an updated worker and, when a NEW build has been installed
// behind an already-running one, surfaces an in-app "new version" toast so the
// user can reload to pick it up (no forced reload — never interrupt a task).
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // A worker already waiting from a previous visit → update ready now.
        if (reg.waiting && navigator.serviceWorker.controller) notifyUpdate();
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // "installed" + an existing controller ⇒ it's an update, not the
            // very first install (which has no controller yet).
            if (installing.state === "installed" && navigator.serviceWorker.controller) notifyUpdate();
          });
        });
      })
      .catch(() => {
        /* PWA is progressive enhancement — a failed registration must not break the app */
      });
  });
}

let notified = false;
function notifyUpdate(): void {
  if (notified) return; // once per session is enough
  notified = true;
  try {
    useStore.getState().pushToast("SUCCESS", "🔄 Nuova versione di SAMS disponibile — ricarica la pagina per aggiornare");
  } catch {
    /* store not ready — ignore */
  }
}
