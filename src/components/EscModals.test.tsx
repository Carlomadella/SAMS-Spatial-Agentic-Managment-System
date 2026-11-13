import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tour } from "./Tour";
import { OnboardingWizard } from "./OnboardingWizard";
import { useStore } from "../store/useStore";

describe("Esc chiude le finestre modali di benvenuto", () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.setState({ tourOpen: false, selectedAgentId: null });
  });

  it("il tour si chiude con Esc e viene segnato come visto", () => {
    useStore.setState({ tourOpen: true });
    render(<Tour />);
    expect(screen.getByRole("dialog", { name: "Tour dell'interfaccia" })).toBeTruthy();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(useStore.getState().tourOpen).toBe(false);
    expect(localStorage.getItem("sams.tour")).toBe("1");
  });

  it("l'onboarding si chiude con Esc e non riappare", () => {
    render(<OnboardingWizard />);
    expect(screen.getByRole("dialog", { name: "Benvenuto in SAMS" })).toBeTruthy();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Benvenuto in SAMS" })).toBeNull();
    expect(localStorage.getItem("sams.welcomed")).toBe("1");
  });

  it("l'Esc che chiude il tour non arriva agli altri ascoltatori (non deseleziona l'agente)", () => {
    let reached = false;
    const later = () => { reached = true; };
    useStore.setState({ tourOpen: true });
    render(<Tour />);
    window.addEventListener("keydown", later);
    fireEvent.keyDown(document.body, { key: "Escape" });
    window.removeEventListener("keydown", later);
    expect(reached).toBe(false);
  });
});
