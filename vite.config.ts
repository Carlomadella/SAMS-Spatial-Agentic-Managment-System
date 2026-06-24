import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Proxy runtime calls so the browser talks to the same origin (no CORS).
    proxy: {
      "/api": { target: "http://localhost:8787", changeOrigin: true },
      // Commit Garden public profile pages, served by the runtime.
      "/u": { target: "http://localhost:8787", changeOrigin: true },
    },
  },
});
