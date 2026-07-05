import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

// In CI we pin a preinstalled software-WebGL Chromium; locally (or if that path
// is absent) we fall back to Playwright's own managed browser so the e2e suite
// runs cross-platform after `npx playwright install chromium`.
const CI_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const useCiChromium = !!process.env.CI && fs.existsSync(CI_CHROMIUM);

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: "http://localhost:4173",
    headless: true,
    // Software WebGL so the 3D scene initialises without a GPU.
    launchOptions: {
      ...(useCiChromium ? { executablePath: CI_CHROMIUM } : {}),
      args: ["--disable-gpu", "--use-gl=swiftshader"],
    },
    viewport: { width: 1280, height: 768 },
    ignoreHTTPSErrors: true,
  },

  webServer: {
    command: "npm run build && npm run preview -- --port 4173",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
