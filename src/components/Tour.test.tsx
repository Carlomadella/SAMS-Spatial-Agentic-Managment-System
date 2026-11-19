import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Tour } from "./Tour";
import { useStore } from "../store/useStore";

// Collaudo sim-prenota-sale (17/11): al primo accesso il tour partiva da solo sopra la
// finestra delle Impostazioni (aperta al ritorno da GitHub su «Il tuo GitHub») e ne
// copriva il pulsante "Collega GitHub". Con le Impostazioni aperte il tour si fa da parte.
describe("<Tour /> e la finestra Impostazioni", () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.setState({ tourOpen: true, settingsOpen: false });
  });

  it("si vede quando le Impostazioni sono chiuse", () => {
    render(<Tour />);
    expect(screen.getByRole("dialog", { name: "Tour dell'interfaccia" })).toBeTruthy();
  });

  it("non copre le Impostazioni aperte e ricompare quando si chiudono", () => {
    useStore.setState({ settingsOpen: true });
    render(<Tour />);
    expect(screen.queryByRole("dialog", { name: "Tour dell'interfaccia" })).toBeNull();
    act(() => useStore.setState({ settingsOpen: false }));
    expect(screen.getByRole("dialog", { name: "Tour dell'interfaccia" })).toBeTruthy();
  });

  it("farsi da parte non lo segna come già visto", () => {
    useStore.setState({ settingsOpen: true });
    render(<Tour />);
    expect(localStorage.getItem("sams.tour")).toBeNull();
    expect(useStore.getState().tourOpen).toBe(true);
  });
});
