// Registers the service worker that makes SAMS an installable, offline-capable
// PWA. Only runs in a production build (never during `vite dev`, where a cached
// shell would fight HMR) and only when the browser supports service workers.
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* PWA is progressive enhancement — a failed registration must not break the app */
    });
  });
}
