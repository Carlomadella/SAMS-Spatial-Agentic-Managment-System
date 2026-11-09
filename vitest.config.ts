import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Frontend unit tests (store, pure logic). jsdom gives us localStorage so the
// zustand `persist` middleware works under test. The Playwright e2e suite lives
// separately under e2e/ and is excluded here.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", "server/**"],
    setupFiles: ["src/test/setup.ts"],
    // Il primo test di ogni file paga l'avvio a freddo di jsdom + import di three/lucide:
    // con tutti i worker in parallelo supera i 5 s di default e fallisce a caso (un file
    // diverso a ogni giro). 20 s assorbe il carico senza mascherare un test davvero appeso.
    testTimeout: 20_000,
  },
});
