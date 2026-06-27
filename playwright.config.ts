import { defineConfig, devices } from "@playwright/test";

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
    // Software WebGL so the 3D scene initialises in CI without a GPU.
    launchOptions: {
      executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
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
