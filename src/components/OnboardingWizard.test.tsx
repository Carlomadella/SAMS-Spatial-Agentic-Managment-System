import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OnboardingWizard } from "./OnboardingWizard";
import { useStore } from "../store/useStore";

/** Apre il secondo passo ("Come iniziare") e ne restituisce il testo. */
function secondStep(): string {
  render(<OnboardingWizard />);
  fireEvent.click(screen.getByText("Avanti"));
  return screen.getByRole("dialog").textContent ?? "";
}

describe("<OnboardingWizard /> — passi giusti per chi entra", () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.setState({ viewerRole: "owner", backendOnline: true, runtimeReady: false, settingsOpen: false });
  });

  it("non promette un provider gratuito né parla di porte", () => {
    const text = secondStep();
    expect(text).not.toMatch(/gratuit/i);
    expect(text).not.toContain("8787");
  });

  it("owner con il motore da configurare: lo manda al Motore AI", () => {
    const text = secondStep();
    expect(text).toContain("Motore AI");
    fireEvent.click(screen.getByText("Apri impostazioni"));
    expect(useStore.getState().settingsOpen).toBe(true);
  });

  it("viewer: niente impostazioni da aprire né task da assegnare", () => {
    useStore.setState({ viewerRole: "viewer" });
    const text = secondStep();
    expect(text).not.toContain("Assegna");
    expect(text).toContain("proprietario");
    expect(screen.queryByText("Apri impostazioni")).toBeNull();
    fireEvent.click(screen.getByText("Inizia"));
    expect(useStore.getState().settingsOpen).toBe(false);
  });

  it("runtime pronto: niente passo di configurazione", () => {
    useStore.setState({ runtimeReady: true });
    const text = secondStep();
    expect(text).not.toContain("Motore AI");
    expect(text).toContain("Assegna il primo task");
    expect(screen.getByText("Inizia")).toBeTruthy();
  });

  it("runtime che non risponde: lo dice, senza comandi da terminale", () => {
    useStore.setState({ backendOnline: false });
    const text = secondStep();
    expect(text).toMatch(/non risponde/);
  });
});
