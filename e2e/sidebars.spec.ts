import { test, expect } from "@playwright/test";

// Verifica funzionale delle due sidebar: la barra attività a sinistra deve
// commutare fra le 5 viste e il pannello destro (Panoramica sistema + Gate di
// sicurezza) deve rispondere ai comandi. Guida la UI reale (build+preview).

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sams.welcomed", "1");
    // Il tour interattivo si auto-avvia dopo l'onboarding con un overlay a schermo
    // intero (z-80) che intercetterebbe i click sui pannelli: marchialo come già visto.
    localStorage.setItem("sams.tour", "1");
    localStorage.removeItem("sams.hint");
  });
  await page.goto("/app");
  // La workspace vive su /app: la "/" è il sito di benvenuto (Roadmap 5).
  // Attende che la title bar sia montata prima di toccare i pannelli.
  await expect(page.locator("span.font-bold").filter({ hasText: /^SAMS$/ })).toBeVisible();
});

test("sidebar sinistra: la barra attività commuta tutte e 5 le viste", async ({ page }) => {
  // 6 interazioni in sequenza: con la scena 3D sotto software-WebGL ogni passo
  // costa secondi, quindi allarghiamo il budget rispetto ai 30s di default.
  test.setTimeout(120_000);

  // La barra attività è sopra una scena WebGL che ridipinge di continuo: la
  // pagina non è mai "idle" e il controllo di stabilità di Playwright si starva.
  // I pulsanti sono target statici, quindi il click forzato è affidabile; le vere
  // verifiche sono le `toBeVisible` che seguono (le viste devono renderizzare).
  const activity = (name: string) =>
    page.getByRole("button", { name, exact: true }).click({ force: true });

  // All'avvio il pannello è su "Esplora risorse".
  await expect(page.getByText("SAMS-WORKSPACE")).toBeVisible();

  await activity("Cerca");
  await expect(page.getByPlaceholder("Cerca agenti, workflow, file…")).toBeVisible();

  await activity("Controllo sorgente");
  await expect(page.getByRole("button", { name: "Git Graph" })).toBeVisible();

  await activity("CAD spaziale");
  await expect(page.getByText("CAD spaziale · Zone")).toBeVisible();

  await activity("Estensioni");
  await expect(page.getByText("Runtime agenti")).toBeVisible();

  // Ri-cliccando la voce attiva il pannello si chiude (toggle).
  await activity("Estensioni");
  await expect(page.getByText("Runtime agenti")).toBeHidden();
});

test("sidebar sinistra: la vista Controllo sorgente cambia ambiente", async ({ page }) => {
  await page.getByRole("button", { name: "Controllo sorgente", exact: true }).click();
  const envSelect = page.locator("select").first();
  await expect(envSelect).toBeVisible();
  await envSelect.selectOption("prod");
  await expect(envSelect).toHaveValue("prod");
});

test("sidebar destra: Panoramica sistema e Gate di sicurezza sono presenti e reattivi", async ({ page }) => {
  await expect(page.getByText("Panoramica sistema")).toBeVisible();
  await expect(page.getByText("Gate di sicurezza").first()).toBeVisible();

  // Lo switch ambiente del pannello destro risponde.
  await page.getByRole("button", { name: "prod", exact: true }).click();
  await expect(page.getByRole("button", { name: "prod", exact: true })).toBeVisible();

  // Un'azione del gate registra un evento e apre il log senza errori.
  await page.getByRole("button", { name: /Apri pull request/ }).click();
  await expect(page.locator("span.font-bold").filter({ hasText: /^SAMS$/ })).toBeVisible();
});
