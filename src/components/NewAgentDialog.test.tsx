import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NewAgentDialog } from "./NewAgentDialog";
import { useStore } from "../store/useStore";
import { SEED_AGENTS } from "../data/seed";

// Collaudo sim-prenota-sale: "+ Agente" / "Crea agente" creava subito un agente con
// un clic, senza conferma. Scelta dell'utente (19/11): una finestra che chiede nome e
// ruolo, con Crea / Annulla.
const dialog = () => screen.queryByRole("dialog", { name: "Nuovo agente" });

describe("<NewAgentDialog />", () => {
  beforeEach(() => {
    useStore.setState({ agents: structuredClone(SEED_AGENTS), newAgentOpen: null, selectedAgentId: null });
  });

  it("chiedere un nuovo agente apre la finestra senza crearlo", () => {
    const before = useStore.getState().agents.length;
    useStore.getState().openNewAgent();
    render(<NewAgentDialog />);
    expect(dialog()).toBeTruthy();
    expect(useStore.getState().agents.length).toBe(before);
  });

  it("Annulla chiude senza creare nulla", () => {
    const before = useStore.getState().agents.length;
    useStore.getState().openNewAgent();
    render(<NewAgentDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(dialog()).toBeNull();
    expect(useStore.getState().agents.length).toBe(before);
  });

  it("Esc chiude senza creare nulla", () => {
    const before = useStore.getState().agents.length;
    useStore.getState().openNewAgent();
    render(<NewAgentDialog />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(dialog()).toBeNull();
    expect(useStore.getState().agents.length).toBe(before);
  });

  it("Crea aggiunge l'agente col nome e il ruolo scelti e lo seleziona", () => {
    useStore.getState().openNewAgent();
    render(<NewAgentDialog />);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Sim-Dev-2" } });
    fireEvent.change(screen.getByLabelText("Ruolo"), { target: { value: "Tester" } });
    fireEvent.click(screen.getByRole("button", { name: "Crea" }));
    const s = useStore.getState();
    const created = s.agents.find((a) => a.name === "Sim-Dev-2");
    expect(created).toMatchObject({ role: "Tester" });
    expect(s.selectedAgentId).toBe(created!.id);
    expect(dialog()).toBeNull();
  });

  it("propone un nome libero e rispetta il colore chiesto", () => {
    useStore.getState().openNewAgent("purple");
    render(<NewAgentDialog />);
    const name = (screen.getByLabelText("Nome") as HTMLInputElement).value;
    expect(useStore.getState().agents.some((a) => a.name === name)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Crea" }));
    expect(useStore.getState().agents.find((a) => a.name === name)?.color).toBe("purple");
  });

  it("con un nome già usato non crea un doppione", () => {
    const taken = useStore.getState().agents[0]!.name;
    useStore.getState().openNewAgent();
    render(<NewAgentDialog />);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: taken } });
    fireEvent.click(screen.getByRole("button", { name: "Crea" }));
    expect(useStore.getState().agents.filter((a) => a.name === taken)).toHaveLength(1);
  });

  // ROADMAP5 (20/11): il preimpostato è un'opzione in più, mai obbligatorio.
  it("di default parte da «Nessuno» e crea un agente vuoto come prima", () => {
    useStore.getState().openNewAgent();
    render(<NewAgentDialog />);
    expect((screen.getByLabelText("Parti da") as HTMLSelectElement).value).toBe("");
    expect(screen.queryByText(/Regole \(istruzioni permanenti/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Vuoto-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Crea" }));
    const created = useStore.getState().agents.find((a) => a.name === "Vuoto-1")!;
    expect(created.instructions).toBe("");
    expect(created.presetId).toBeUndefined();
  });

  it("scelto un preimpostato mostra descrizione e regole, modificabili prima di creare", () => {
    useStore.getState().openNewAgent();
    render(<NewAgentDialog />);
    fireEvent.change(screen.getByLabelText("Parti da"), { target: { value: "reviewer" } });
    expect(screen.getByText(/annota bug, stile e sicurezza/)).toBeTruthy();
    expect((screen.getByLabelText("Ruolo") as HTMLSelectElement).value).toBe("Revisore");
    const rules = screen.getByLabelText(/Regole/) as HTMLTextAreaElement;
    expect(rules.value).toContain("gh_comment_pr");
    fireEvent.change(rules, { target: { value: "Rivedi e correggi tu stesso." } });
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Rev-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Crea" }));
    const created = useStore.getState().agents.find((a) => a.name === "Rev-1")!;
    expect(created).toMatchObject({ role: "Revisore", instructions: "Rivedi e correggi tu stesso.", presetId: "reviewer" });
  });

  it("tornando a «Nessuno» le regole spariscono", () => {
    useStore.getState().openNewAgent();
    render(<NewAgentDialog />);
    fireEvent.change(screen.getByLabelText("Parti da"), { target: { value: "architect" } });
    fireEvent.change(screen.getByLabelText("Parti da"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Vuoto-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Crea" }));
    expect(useStore.getState().agents.find((a) => a.name === "Vuoto-2")!.instructions).toBe("");
  });
});
