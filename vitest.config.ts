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
  },
});
