import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const deleteWorldAgent = vi.fn(async (_id: string) => 7);
vi.mock("../lib/backend", async (orig) => ({ ...(await orig<typeof import("../lib/backend")>()), deleteWorldAgent }));

const { RemoveAgentDialog } = await import("./RemoveAgentDialog");
const { useStore } = await import("../store/useStore");

describe("conferma prima di eliminare un agente (24/11)", () => {
  let id = "";
  beforeEach(() => {
    deleteWorldAgent.mockClear();
    useStore.setState({ agents: [], agentToRemove: null, backendOnline: true, viewerRole: "owner", serverWorldVersion: 3 });
    id = useStore.getState().addAgent("blue", { name: "Da-Togliere" });
  });

  it("il cestino chiede conferma: l'agente resta finché non si conferma", () => {
    useStore.getState().askRemoveAgent(id);
    render(<RemoveAgentDialog />);
    expect(screen.getByRole("dialog", { name: "Eliminare l'agente?" })).toBeTruthy();
    expect(screen.getByText(/Da-Togliere/)).toBeTruthy();
    expect(useStore.getState().agents.some((a) => a.id === id)).toBe(true);
  });

  it("Annulla chiude e non elimina nulla", () => {
    useStore.getState().askRemoveAgent(id);
    render(<RemoveAgentDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(useStore.getState().agentToRemove).toBeNull();
    expect(useStore.getState().agents.some((a) => a.id === id)).toBe(true);
    expect(deleteWorldAgent).not.toHaveBeenCalled();
  });

  it("Esc vale come Annulla", () => {
    useStore.getState().askRemoveAgent(id);
    render(<RemoveAgentDialog />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(useStore.getState().agentToRemove).toBeNull();
    expect(useStore.getState().agents.some((a) => a.id === id)).toBe(true);
  });

  it("Elimina toglie l'agente e lo cancella subito anche sul server", async () => {
    useStore.getState().askRemoveAgent(id);
    render(<RemoveAgentDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Elimina" }));
    expect(useStore.getState().agents.some((a) => a.id === id)).toBe(false);
    expect(useStore.getState().agentToRemove).toBeNull();
    expect(deleteWorldAgent).toHaveBeenCalledWith(id);
    await vi.waitFor(() => expect(useStore.getState().serverWorldVersion).toBe(7));
  });

  it("chi non è owner non può eliminare: niente finestra, l'agente resta", () => {
    for (const role of ["editor", "viewer"] as const) {
      useStore.setState({ viewerRole: role });
      useStore.getState().askRemoveAgent(id);
      const { unmount } = render(<RemoveAgentDialog />);
      expect(screen.queryByRole("dialog", { name: "Eliminare l'agente?" })).toBeNull();
      expect(useStore.getState().agents.some((a) => a.id === id)).toBe(true);
      unmount();
    }
    expect(deleteWorldAgent).not.toHaveBeenCalled();
  });

  it("senza runtime elimina solo in locale", () => {
    useStore.setState({ backendOnline: false });
    useStore.getState().askRemoveAgent(id);
    render(<RemoveAgentDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Elimina" }));
    expect(useStore.getState().agents.some((a) => a.id === id)).toBe(false);
    expect(deleteWorldAgent).not.toHaveBeenCalled();
  });
});
