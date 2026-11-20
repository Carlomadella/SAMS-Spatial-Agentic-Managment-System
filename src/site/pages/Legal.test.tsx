import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../router", () => ({
  Link: ({ children, to, ...rest }: { children?: React.ReactNode; to: string }) => <a href={to} {...rest}>{children}</a>,
}));

import { Privacy } from "./Privacy";
import { Terms } from "./Terms";
import { CONTACT_PLACEHOLDER, LICENSE_PLACEHOLDER, OWNER_PLACEHOLDER } from "../data/legal";

// ROADMAP5 (20/11/2026): nel footer "Privacy" e "Termini" puntavano a /#site-footer.
// Titolare, contatto e licenza non sono ancora decisi (scelta dell'utente): restano
// segnaposto visibili, con un avviso di bozza, finché non si compilano in data/legal.ts.
describe("pagine legali", () => {
  it("la Privacy descrive i dati veri, i fornitori AI e come eliminare l'account", () => {
    render(<Privacy />);
    expect(screen.getByRole("heading", { level: 1, name: "Informativa sulla privacy" })).toBeTruthy();
    const text = document.body.textContent ?? "";
    expect(text).toContain("hash");
    expect(text).toContain("OpenRouter");
    expect(text).toContain("localStorage");
    expect(text).toContain("Elimina account");
    expect(text).toContain("16 anni");
    expect(screen.getByRole("link", { name: "Profilo" }).getAttribute("href")).toBe("/profilo");
  });

  it("i Termini dicono che il lavoro degli agenti va controllato e coprono chi installa SAMS", () => {
    render(<Terms />);
    expect(screen.getByRole("heading", { level: 1, name: "Termini d'uso" })).toBeTruthy();
    const text = document.body.textContent ?? "";
    expect(text).toContain("possono sbagliare");
    expect(text).toContain("Se installi SAMS da te");
    expect(screen.getByRole("link", { name: "informativa sulla privacy" }).getAttribute("href")).toBe("/privacy");
  });

  it("finché mancano titolare, contatto e licenza mostra segnaposto e avviso di bozza", () => {
    render(<Terms />);
    const text = document.body.textContent ?? "";
    for (const p of [OWNER_PLACEHOLDER, CONTACT_PLACEHOLDER, LICENSE_PLACEHOLDER]) expect(text).toContain(p);
    expect(screen.getByRole("note").textContent).toMatch(/Bozza/);
  });
});
