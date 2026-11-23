import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ViewLoading } from "./App";

// Collaudo 21/11, punto 6.7: niente lampo chiaro prima della stanza scura.
describe("ViewLoading", () => {
  afterEach(() => localStorage.removeItem("sams.theme"));

  it("di base è scuro come la stanza", () => {
    render(<ViewLoading label="Caricamento della stanza…" />);
    const el = screen.getByRole("status");
    expect(el.dataset.tone).toBe("dark");
    expect(el.className).toContain("bg-black");
  });

  it("con il tema chiaro salvato resta chiaro", () => {
    localStorage.setItem("sams.theme", "light");
    render(<ViewLoading label="x" />);
    expect(screen.getByRole("status").dataset.tone).toBe("light");
  });
});
