import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // the three.js/drei scene chunk is legitimately large; raise the warning bar
    chunkSizeWarningLimit: 1200,
  },
  server: {
    host: true,
    port: 5180,
    // Porta fissa: se è occupata Vite si ferma invece di spostarsi su un'altra.
    strictPort: true,
    // Proxy runtime calls so the browser talks to the same origin (no CORS).
    proxy: {
      "/api": { target: "http://localhost:8787", changeOrigin: true },
      // Commit Garden public profile pages, served by the runtime.
      "/u": { target: "http://localhost:8787", changeOrigin: true },
    },
  },
});
