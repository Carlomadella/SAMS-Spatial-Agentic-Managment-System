import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { registerServiceWorker } from "./lib/pwa";
import { useStore } from "./store/useStore";
import "./index.css";

// Aggancio allo store **solo in sviluppo**: serve a pilotare la scena da fuori senza
// passare per l'interfaccia — è così che si registra il video della hero (agenti che
// camminano, lavorano, dormono) senza che compaiano menu o pannelli. Utile anche per
// ispezionare lo stato dalla console. In produzione questo ramo non esiste: Vite
// sostituisce `import.meta.env.DEV` con `false` e il bundler lo rimuove.
if (import.meta.env.DEV) {
  (window as unknown as { __samsStore?: typeof useStore }).__samsStore = useStore;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

registerServiceWorker();
