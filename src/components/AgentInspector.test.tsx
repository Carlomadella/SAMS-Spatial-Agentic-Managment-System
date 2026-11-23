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

// Collaudo 21/11, punto 4: con l'approvazione obbligatoria un workflow chiesto dall'agente
// aspetta la conferma, e il pannello lo mostra anche quando non ci sono file.
describe("<AgentInspector /> — workflow in attesa", () => {
  afterEach(() => useStore.setState({ selectedAgentId: null }));

  it("mostra il workflow da avviare nel pannello di approvazione", () => {
    const first = useStore.getState().agents[0];
    useStore.setState({
      selectedAgentId: first.id,
      viewerRole: "owner",
      agents: useStore.getState().agents.map((a) =>
        a.id === first.id ? { ...a, status: "awaiting_approval", pendingFiles: [], pendingWorkflow: { workflow: "ci.yml", ref: "sams/x/fix" } } : a,
      ),
    });
    render(<AgentInspector />);
    expect(screen.getByTestId("pending-panel")).toBeTruthy();
    expect(screen.getByTestId("pending-workflow").textContent).toContain("ci.yml su sams/x/fix");
  });
});
