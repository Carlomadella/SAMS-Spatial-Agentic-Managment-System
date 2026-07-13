import { expect, test } from "@playwright/test";

// Smoke temporaneo per le route del sito (Roadmap 5). Verifica che le pagine rendano e
// che il router interno navighi senza reload.

test("home rende hero + navbar", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("agenti AI");
  await expect(page.getByRole("link", { name: "Apri la stanza" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Entra nella stanza" })).toBeVisible();
});

test("navbar naviga a Docs senza reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Docs", exact: true }).first().click();
  await expect(page).toHaveURL(/\/docs$/);
  await expect(page.getByRole("heading", { name: "Come funziona SAMS" })).toBeVisible();
});

test("login mock porta alla stanza", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText(/Accesso dimostrativo/)).toBeVisible();
  await page.getByPlaceholder("tu@esempio.com").fill("ada@esempio.com");
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test("profilo è protetto: redirect a login", async ({ page }) => {
  await page.goto("/profilo");
  await expect(page).toHaveURL(/\/login$/);
});

test("deep-link /docs funziona (fallback SPA)", async ({ page }) => {
  await page.goto("/docs");
  await expect(page.getByRole("heading", { name: "Come funziona SAMS" })).toBeVisible();
});

test("changelog vive su /changelog (fuori dalla home)", async ({ page }) => {
  await page.goto("/");
  // non è più in home
  await expect(page.locator("#novita")).toHaveCount(0);
  // ma è raggiungibile dal footer
  await page.getByRole("link", { name: "Changelog", exact: true }).click();
  await expect(page).toHaveURL(/\/changelog$/);
  await expect(page.getByRole("heading", { name: "Novità di SAMS" })).toBeVisible();
});

test("palette del sito è ambra, non il blu dell'app", async ({ page }) => {
  await page.goto("/");
  const accent = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--c-accent").trim());
  expect(accent).toBe("245 158 11"); // ambra
});

test("tema chiaro: il titolo hero resta leggibile (non bianco)", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("sams.theme", "light"));
  await page.reload();
  const h1 = page.getByRole("heading", { level: 1 });
  const color = await h1.evaluate((el) => getComputedStyle(el).color);
  // in tema chiaro il colore deve essere scuro, non bianco/quasi-bianco
  const [r, g, b] = color.match(/\d+/g)!.map(Number);
  expect(r + g + b).toBeLessThan(250);
});
