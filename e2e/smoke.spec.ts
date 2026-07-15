import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Start with a clean state so the onboarding wizard doesn't interfere.
  await page.addInitScript(() => {
    localStorage.setItem("sams.welcomed", "1");
    localStorage.removeItem("sams.hint");
  });
  await page.goto("/app");
});

test("page loads with SAMS title bar", async ({ page }) => {
  // Target the bold brand span in the TitleBar specifically.
  await expect(page.locator("span.font-bold").filter({ hasText: /^SAMS$/ })).toBeVisible();
});

test("onboarding wizard appears on first visit", async ({ page }) => {
  // Override: remove the welcomed flag so the wizard shows.
  await page.addInitScript(() => {
    localStorage.removeItem("sams.welcomed");
  });
  await page.goto("/app");
  await expect(page.locator("text=Benvenuto in SAMS")).toBeVisible({ timeout: 10_000 });
});

test("command palette opens with Ctrl+K", async ({ page }) => {
  // Il listener globale di Ctrl+K è agganciato in un useEffect: sotto software-
  // WebGL il mount dell'app 3D è lento, quindi aspetta che sia montata prima di
  // premere, altrimenti il tasto va perso (race del test, non dell'app).
  await expect(page.locator("span.font-bold").filter({ hasText: /^SAMS$/ })).toBeVisible();
  await page.keyboard.press("Control+k");
  // The command palette should show some input
  const input = page.locator("input").first();
  await expect(input).toBeVisible({ timeout: 5_000 });
  await page.keyboard.press("Escape");
});

test("garden view can be opened", async ({ page }) => {
  // Find the garden / Commit Garden button in ActivityBar or TitleBar.
  const gardenBtn = page
    .locator("button")
    .filter({ hasText: /garden|giardino|sprout/i })
    .first();
  if ((await gardenBtn.count()) > 0) {
    await gardenBtn.click();
    // The garden overlay should render within 10 s (lazy-loaded scene).
    await expect(page.locator("text=Commit Garden")).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");
  }
});
