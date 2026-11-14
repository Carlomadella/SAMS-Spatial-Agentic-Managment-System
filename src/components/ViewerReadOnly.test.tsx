import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommandPalette } from "./CommandPalette";
import { TitleBar } from "./TitleBar";
import { Terminal } from "./Terminal";
import { useStore } from "../store/useStore";

const openPalette = () => {
  useStore.setState({ commandOpen: true });
  render(<CommandPalette />);
};

describe("un viewer non vede comandi che cambiano il mondo", () => {
  beforeEach(() => {
    // jsdom non implementa scrollTo sugli elementi (lo usa il terminale per scendere in fondo).
    if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
    useStore.setState({ commandOpen: false, viewerRole: "owner", selectedAgentId: null });
  });

  it("palette: l'editor vede crea agente, caffè e reset", () => {
    useStore.setState({ viewerRole: "editor" });
    openPalette();
    expect(screen.queryByText("Crea nuovo agente")).toBeTruthy();
    expect(screen.queryByText("Pausa caffè per tutti")).toBeTruthy();
    expect(screen.queryByText("Reimposta l'area di lavoro")).toBeTruthy();
  });

  it("palette: il viewer non li vede, ma può ancora aprire impostazioni e tour", () => {
    const first = useStore.getState().agents[0];
    useStore.setState({ viewerRole: "viewer", selectedAgentId: first?.id ?? null });
    openPalette();
    expect(screen.queryByText("Crea nuovo agente")).toBeNull();
    expect(screen.queryByText(/^Crea agente /)).toBeNull();
    expect(screen.queryByText("Pausa caffè per tutti")).toBeNull();
    expect(screen.queryByText("Reimposta l'area di lavoro")).toBeNull();
    expect(screen.queryByText(/^Invia .* → /)).toBeNull();
    expect(screen.queryByText("Apri Impostazioni")).toBeTruthy();
    expect(screen.queryByText("Avvia tour dell'interfaccia")).toBeTruthy();
  });

  it("barra in alto: il bottone '+ Agente' sparisce per il viewer", () => {
    useStore.setState({ viewerRole: "viewer" });
    const { unmount } = render(<TitleBar />);
    expect(screen.queryByLabelText("Aggiungi agente")).toBeNull();
    unmount();
    useStore.setState({ viewerRole: "editor" });
    render(<TitleBar />);
    expect(screen.queryByLabelText("Aggiungi agente")).toBeTruthy();
  });

  it("terminale: 'spawn' da viewer risponde sola lettura e non crea agenti", () => {
    useStore.setState({ viewerRole: "viewer" });
    const before = useStore.getState().agents.length;
    render(<Terminal />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "spawn Pippo" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(useStore.getState().agents.length).toBe(before);
    expect(screen.getByText(/sola lettura/)).toBeTruthy();
  });
});
