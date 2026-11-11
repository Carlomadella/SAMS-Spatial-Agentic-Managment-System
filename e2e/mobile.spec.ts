import { test, expect, type Page } from "@playwright/test";

// Stanza su un telefono (issue #3, collaudo pre-rilascio del 2026-11-10): a 390 px l'header
// debordava (giardino tagliato, ricerca su tre righe), l'Inspector copriva il pannello
// inferiore e la barra di stato usciva dallo schermo.

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sams.welcomed", "1");
    localStorage.setItem("sams.tour", "1");
  });
  await page.goto("/app");
  await expect(page.locator("span.font-bold").filter({ hasText: /^SAMS$/ })).toBeVisible();
});

async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  expect(b, `${selector} non trovato`).not.toBeNull();
  return b!;
}

function inside(b: { x: number; y: number; width: number; height: number }, w = 390, h = 844) {
  expect(b.x).toBeGreaterThanOrEqual(-0.5);
  expect(b.y).toBeGreaterThanOrEqual(-0.5);
  expect(b.x + b.width).toBeLessThanOrEqual(w + 0.5);
  expect(b.y + b.height).toBeLessThanOrEqual(h + 0.5);
}

test("niente scroll orizzontale", async ({ page }) => {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(sw).toBeLessThanOrEqual(iw);
});

test("header su una riga, con tutti i bottoni dentro lo schermo", async ({ page }) => {
  const header = await box(page, "header");
  expect(header.height).toBeLessThanOrEqual(49);
  inside(header);
  for (const b of await page.locator("header button").all()) {
    if (!(await b.isVisible())) continue;
    inside((await b.boundingBox())!);
  }
  // Il Commit Garden intero, non tagliato.
  inside(await box(page, 'header button[title="Commit Garden"]'));
  // La ricerca è un bottone di una riga sola.
  expect((await box(page, 'header button[aria-label="Digita un comando o cerca"]')).height).toBeLessThanOrEqual(33);
});

test("barra di stato su una riga e dentro lo schermo", async ({ page }) => {
  const bar = await box(page, "footer");
  expect(bar.height).toBeLessThanOrEqual(25);
  inside(bar);
  // La barra ha un'altezza fissa: a uscire erano i suoi elementi, andati a capo.
  const outside = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll("footer *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.push((el.textContent ?? "").trim().slice(0, 30));
    }
    return out;
  });
  expect(outside).toEqual([]);
});

test("il pannello inferiore usa tutta la larghezza: niente Inspector sopra", async ({ page }) => {
  await expect(page.getByText("Seleziona un agente nella scena")).toBeHidden();
  const tabs = await box(page, '[data-tour="bottom"]');
  inside(tabs);
});

test("l'Inspector sta nel suo drawer e niente ci finisce sopra", async ({ page }) => {
  await page.keyboard.press("Tab"); // seleziona il primo agente
  await page.getByRole("button", { name: "Inspector" }).click();
  const drawer = await box(page, '[data-tour="inspector"]');
  inside(drawer);
  // In vari punti del drawer l'elemento in cima è del drawer stesso, non un'etichetta 3D.
  const covered = await page.evaluate(() => {
    const d = document.querySelector('[data-tour="inspector"]')!;
    const r = d.getBoundingClientRect();
    const out: string[] = [];
    for (let y = r.top + 10; y < r.bottom - 10; y += 40) {
      for (const x of [r.left + 20, (r.left + r.right) / 2, r.right - 20]) {
        const el = document.elementFromPoint(x, y);
        if (el && !d.contains(el)) out.push(`${Math.round(x)},${Math.round(y)}: ${el.textContent?.slice(0, 30)}`);
      }
    }
    return out;
  });
  expect(covered).toEqual([]);
});
