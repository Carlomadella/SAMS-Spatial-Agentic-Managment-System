import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentInspector } from "./AgentInspector";
import { useStore } from "../store/useStore";

// Collaudo 21/11: spostando l'avviso «senza GitHub» il riquadro rosso aveva inghiottito
// tutti i campi del task, che sparivano quando non c'era nessun blocco (il caso normale).
describe("<AgentInspector /> — il modulo «Assegna un task»", () => {
  beforeEach(() => {
    const first = useStore.getState().agents[0];
    useStore.setState({ selectedAgentId: first.id, viewerRole: "owner", backendOnline: true, githubAccount: null });
  });
  afterEach(() => useStore.setState({ selectedAgentId: null, backendOnline: false, toolsReady: null }));

  it("con gli strumenti pronti si vedono i campi e nessun avviso", () => {
    useStore.setState({ toolsReady: true });
    render(<AgentInspector />);
    expect(screen.getByPlaceholderText("Titolo del task…")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("senza strumenti l'avviso c'è, ma i campi restano fuori dal riquadro", () => {
    useStore.setState({ toolsReady: false });
    render(<AgentInspector />);
    const status = screen.getByRole("status");
    const titleInput = screen.getByPlaceholderText("Titolo del task…");
    expect(status.contains(titleInput)).toBe(false);
  });
});
