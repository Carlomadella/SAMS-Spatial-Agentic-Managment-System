import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommandPalette } from "./CommandPalette";
import { useStore } from "../store/useStore";

// Collaudo 21/11, punto 6.9: le finestre devono essere riconoscibili dai lettori di schermo.
describe("<CommandPalette /> — accessibilità", () => {
  afterEach(() => useStore.setState({ commandOpen: false }));

  it("aperta è una finestra modale con nome, e il campo ha un'etichetta", () => {
    useStore.setState({ commandOpen: true });
    render(<CommandPalette />);
    const dlg = screen.getByRole("dialog", { name: "Palette dei comandi" });
    expect(dlg.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByLabelText("Cerca un comando")).toBeTruthy();
  });
});
