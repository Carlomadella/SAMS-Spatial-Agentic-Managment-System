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
  await expect(page.locator("p.text-red-400")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("il design lab applica la palette al sito vero", async ({ page }) => {
  await page.goto("/design");
  // Il bottone della navbar prende il colore dell'accento: qui si vede se la palette è viva.
  // `poll` e non una lettura secca: il bottone ha una transizione, e a metà animazione il
  // colore è un valore intermedio (né ambra né verde).
  const cta = page.getByRole("link", { name: "Apri la stanza" }).first();
  const bg = () => cta.evaluate((el) => getComputedStyle(el).backgroundColor);

  await page.getByRole("button", { name: /Foresta/ }).click();
  await expect.poll(bg).toBe("rgb(16, 185, 129)"); // il verde di Foresta

  // e la scelta sopravvive al reload (è persistita)
  await page.reload();
  await expect.poll(bg).toBe("rgb(16, 185, 129)");
});

test("il design lab cambia la navbar davvero", async ({ page }) => {
  await page.goto("/design");
  await expect(page.getByRole("link", { name: "Apri la stanza" }).first()).toBeVisible();
  await page.getByRole("button", { name: /Minima/ }).click();
  await expect(page.getByRole("link", { name: "Apri la stanza" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Accedi" }).first()).toBeVisible(); // l'ingresso resta
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
