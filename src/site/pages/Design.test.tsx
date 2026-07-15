import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// `useLocation` serve al NavItem della navbar (stato attivo), `Link` a Logo/CTAButton.
vi.mock("../router", () => ({
  Link: ({ children, ...rest }: { children?: React.ReactNode; to: string }) => <a {...rest}>{children}</a>,
  useLocation: () => ({ path: "/design", search: "" }),
  useNavigate: () => vi.fn(),
}));

import { Design } from "./Design";
import { DesignProvider } from "../design/DesignContext";
import { Navbar } from "../components/Navbar";
import { PALETTES } from "../data/palettes";

// La navbar reale monta ThemeToggle/Logo/CTAButton, che a loro volta usano il router e
// l'auth: qui interessa solo che *reagisca* alla variante scelta, quindi li stubbiamo.
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

const lab = () => render(
  <DesignProvider>
    <Design />
  </DesignProvider>,
);

describe("<Design /> — il design lab", () => {
  beforeEach(() => {
    localStorage.clear();
    document.getElementById("sams-site-palette")?.remove();
  });

  it("mostra tutte e cinque le palette", () => {
    lab();
    for (const p of PALETTES) expect(screen.getByText(p.name)).toBeTruthy();
  });

  it("mostra le sezioni delle tre scelte aperte", () => {
    lab();
    expect(screen.getByText("Palette")).toBeTruthy();
    expect(screen.getByText("Navbar")).toBeTruthy();
    expect(screen.getByText("Hero")).toBeTruthy();
  });

  it("parte con la palette attuale del sito selezionata", () => {
    lab();
    expect(screen.getByText("Ambra / Tramonto").closest("button")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("scegliere una palette la applica al sito (CSS iniettato) e la persiste", () => {
    lab();
    fireEvent.click(screen.getByText("Foresta / Terminale"));

    const tag = document.getElementById("sams-site-palette");
    expect(tag?.textContent).toContain("--c-accent: 16 185 129;"); // il verde di Foresta
    expect(tag?.textContent).toContain(".theme-light body.site-scroll"); // anche la variante chiara
    expect(localStorage.getItem("sams.site.palette")).toBe("foresta");
  });

  it("cambiare palette riscrive lo stesso tag invece di impilarne altri", () => {
    lab();
    fireEvent.click(screen.getByText("Foresta / Terminale"));
    fireEvent.click(screen.getByText("Abisso / Ciano"));

    expect(document.querySelectorAll("#sams-site-palette")).toHaveLength(1);
    const css = document.getElementById("sams-site-palette")?.textContent ?? "";
    expect(css).toContain("--c-accent: 6 182 212;"); // Abisso
    expect(css).not.toContain("--c-accent: 16 185 129;"); // niente residui di Foresta
  });

  it("la selezione si sposta sull'opzione scelta", () => {
    lab();
    fireEvent.click(screen.getByText("Nebulosa / Viola"));
    expect(screen.getByText("Nebulosa / Viola").closest("button")?.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Ambra / Tramonto").closest("button")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("scegliere hero e navbar le persiste", () => {
    lab();
    fireEvent.click(screen.getByText("Video della stanza"));
    fireEvent.click(screen.getByText("Minima — 3 link, solo Accedi"));
    expect(localStorage.getItem("sams.site.hero")).toBe("video");
    expect(localStorage.getItem("sams.site.navbar")).toBe("minima");
  });

  it("«Ripristina» riporta le tre scelte al punto di partenza", () => {
    lab();
    fireEvent.click(screen.getByText("Nebulosa / Viola"));
    fireEvent.click(screen.getByText("Video della stanza"));
    fireEvent.click(screen.getByText("Ripristina il design di partenza"));

    expect(localStorage.getItem("sams.site.palette")).toBe("ambra");
    expect(localStorage.getItem("sams.site.hero")).toBe("immagine");
    expect(localStorage.getItem("sams.site.navbar")).toBe("completa");
  });

  it("mostra il compromesso di ogni hero, non solo il lato buono", () => {
    lab();
    expect(screen.getByText(/megabyte, batteria/)).toBeTruthy(); // video
    expect(screen.getByText(/non fa vedere il prodotto/)).toBeTruthy(); // bagliori
  });
});

describe("la scelta si vede subito nella navbar (è il punto del lab)", () => {
  beforeEach(() => localStorage.clear());

  it("scegliere «Minima» toglie link e CTA dalla navbar montata accanto", () => {
    render(
      <DesignProvider>
        <Navbar />
        <Design />
      </DesignProvider>,
    );
    // "completa" di partenza: GitHub c'è (nella navbar) e la CTA stanza pure
    expect(screen.getAllByText("GitHub").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Apri la stanza").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Minima — 3 link, solo Accedi"));

    // la minima non ha GitHub né "Apri la stanza"
    expect(screen.queryByText("GitHub")).toBeNull();
    expect(screen.queryByText("Apri la stanza")).toBeNull();
    expect(screen.getAllByText("Accedi").length).toBeGreaterThan(0); // l'ingresso resta
  });
});

describe("DesignProvider — robustezza", () => {
  beforeEach(() => localStorage.clear());

  it("un id manomesso in localStorage non lascia il sito senza palette", () => {
    localStorage.setItem("sams.site.palette", "palette-che-non-esiste");
    lab();
    expect(screen.getByText("Ambra / Tramonto").closest("button")?.getAttribute("aria-pressed")).toBe("true");
    expect(document.getElementById("sams-site-palette")?.textContent).toContain("--c-accent: 245 158 11;");
  });

  it("riprende la scelta persistita al montaggio", () => {
    localStorage.setItem("sams.site.palette", "abisso");
    lab();
    expect(screen.getByText("Abisso / Ciano").closest("button")?.getAttribute("aria-pressed")).toBe("true");
  });
});
