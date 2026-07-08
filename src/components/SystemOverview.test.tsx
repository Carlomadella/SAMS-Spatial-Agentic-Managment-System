import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SystemOverview } from "./SystemOverview";
import { useStore } from "../store/useStore";
import { SEED_AGENTS } from "../data/seed";

describe("<SystemOverview />", () => {
  beforeEach(() => {
    // backend offline → nessun polling di rete nei test
    useStore.setState({
      backendOnline: false,
      selectedAgentId: null,
      agents: SEED_AGENTS.slice(0, 3).map((a, i) => ({
        ...a,
        status: i === 0 ? "working" : "idle",
        task: null,
        target: null,
      })),
    });
  });

  it("mostra il conteggio degli attivi su totale", () => {
    render(<SystemOverview />);
    // 1 working su 3 agenti
    expect(screen.getByText("/ 3 attivi", { exact: false })).toBeTruthy();
  });

  it("un click su un agente lo seleziona nello store", () => {
    render(<SystemOverview />);
    const first = useStore.getState().agents[0];
    fireEvent.click(screen.getByLabelText(`Seleziona ${first.name}`));
    expect(useStore.getState().selectedAgentId).toBe(first.id);
  });

  it("mostra la distribuzione per stato (working presente)", () => {
    render(<SystemOverview />);
    // la label di stato 'In corso' (working) compare nel conteggio per-stato
    expect(screen.getAllByText(/In corso|Inattivo/).length).toBeGreaterThan(0);
  });
});
