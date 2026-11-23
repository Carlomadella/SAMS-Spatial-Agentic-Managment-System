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

// Collaudo 21/11, punto 6.3: i pulsanti «Stato» manuali solo con la Live Sim attiva.
describe("<AgentInspector /> — pulsanti Stato", () => {
  afterEach(() => useStore.setState({ selectedAgentId: null, simMode: false }));

  it("fuori dalla simulazione non ci sono", () => {
    useStore.setState({ selectedAgentId: useStore.getState().agents[0].id, simMode: false });
    render(<AgentInspector />);
    expect(screen.queryByTestId("status-quick-set")).toBeNull();
  });

  it("con la Live Sim attiva ci sono", () => {
    useStore.setState({ selectedAgentId: useStore.getState().agents[0].id, simMode: true });
    render(<AgentInspector />);
    expect(screen.getByTestId("status-quick-set")).toBeTruthy();
  });
});

// 24/11: solo l'owner elimina agenti; il cestino apre la conferma, non elimina subito.
describe("<AgentInspector /> — il cestino", () => {
  beforeEach(() => {
    const first = useStore.getState().agents[0];
    useStore.setState({ selectedAgentId: first.id, agentToRemove: null });
  });
  afterEach(() => useStore.setState({ selectedAgentId: null, viewerRole: "owner", agentToRemove: null }));

  it("l'owner lo vede e chiede conferma senza eliminare", () => {
    useStore.setState({ viewerRole: "owner" });
    const id = useStore.getState().selectedAgentId;
    render(<AgentInspector />);
    screen.getByTitle("Rimuovi agente").click();
    expect(useStore.getState().agentToRemove).toBe(id);
    expect(useStore.getState().agents.some((a) => a.id === id)).toBe(true);
  });

  it("editor e viewer non lo vedono", () => {
    for (const role of ["editor", "viewer"] as const) {
      useStore.setState({ viewerRole: role });
      const { unmount } = render(<AgentInspector />);
      expect(screen.queryByTitle("Rimuovi agente")).toBeNull();
      unmount();
    }
  });
});
