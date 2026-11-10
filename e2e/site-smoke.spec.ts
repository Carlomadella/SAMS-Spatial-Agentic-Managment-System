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

// L'accesso non è più mock (auth reale, 2026-07-13): serve una password vera e un runtime
// che risponda. Qui gira solo il sito buildato (vedi webServer in playwright.config), quindi
// verifichiamo il form e il suo comportamento senza runtime — non un login a buon fine.
test("login chiede email e password reali", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByPlaceholder("tu@esempio.com")).toBeVisible();
  await expect(page.getByPlaceholder("••••••••")).toBeVisible();
  await expect(page.getByText(/Accesso dimostrativo/)).toHaveCount(0); // il mock non esiste più
});

test("«Password dimenticata?» chiede la sola email", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Password dimenticata?" }).click();
  await expect(page.getByRole("heading", { name: "Password dimenticata" })).toBeVisible();
  await expect(page.getByPlaceholder("••••••••")).toHaveCount(0); // niente password qui
  await expect(page.getByRole("button", { name: "Mandami il link" })).toBeVisible();
});

// Credenziali inventate → nessuna sessione, si resta fuori. Il messaggio esatto dipende da
// chi risponde (un runtime acceso dice "credenziali errate", uno spento "non raggiungibile"),
// quindi asseriamo il **fatto**: un errore c'è e la stanza non si apre.
test("un accesso fallito non apre la stanza e lo dice", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("tu@esempio.com").fill("nessuno@esempio.com");
  await page.getByPlaceholder("••••••••").fill("password-sbagliata");
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.locator("p.text-rose-400")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("il design lab non c'è più: /design è un 404", async ({ page }) => {
  await page.goto("/design");
  await expect(page.getByRole("button", { name: /Foresta/ })).toHaveCount(0);
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

test("palette del sito è Rossonero, non il blu dell'app", async ({ page }) => {
  await page.goto("/");
  const accent = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--c-accent").trim());
  expect(accent).toBe("227 6 19"); // il rosso di Rossonero — i colori del Milan, scelti per la 1.0
  expect(accent).not.toBe("79 140 255"); // il vecchio blu della workspace non torna
  const base = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--c-ink-950").trim());
  expect(base).toBe("0 0 0"); // il nero dello stemma, non un grigio caldo
});

test("il testo sul bottone primario contrasta con l'accento, in entrambi i temi", async ({ page }) => {
  // Regressione: era bianco su ambra (2.15:1) e in tema chiaro diventava nero su accento
  // scuro. Ora `--c-on-accent` è bianco sul rosso (4.9:1) — vedi i test di data/palettes.ts.
  for (const theme of ["dark", "light"]) {
    await page.goto("/");
    await page.evaluate((t) => localStorage.setItem("sams.theme", t), theme);
    await page.reload();
    const cta = page.getByRole("link", { name: "Entra nella stanza" });
    const { color, bg } = await cta.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { color: cs.color, bg: cs.backgroundColor };
    });
    const lum = (c: string) => {
      const [r, g, b] = c.match(/\d+/g)!.map(Number).slice(0, 3);
      const ch = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : Math.pow((v / 255 + 0.055) / 1.055, 2.4));
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    };
    const [hi, lo] = [lum(color), lum(bg)].sort((a, b) => b - a);
    expect((hi + 0.05) / (lo + 0.05), `contrasto in tema ${theme}`).toBeGreaterThanOrEqual(4.5);
  }
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
