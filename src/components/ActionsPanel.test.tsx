import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ActionsPanel } from "./ActionsPanel";
import { useStore } from "../store/useStore";
import { SEED_AGENTS } from "../data/seed";

// Il Gate mostra lo stato vero (modifiche in attesa) e porta alle viste reali: nessuna
// azione deve più scrivere nel log eventi finti come "Push effettuato" (regola "solo eventi veri").

function seed(pending: boolean) {
  useStore.setState({
    events: [],
    leftOpen: false,
    activity: "explorer",
    selectedAgentId: null,
    agents: [
      {
        ...SEED_AGENTS[0],
        status: pending ? "review" : "idle",
        pendingFiles: pending
          ? [
              { path: "src/a.ts", content: "x", message: "fix" },
              { path: "src/b.ts", content: "y", message: "fix" },
            ]
          : undefined,
      },
      { ...SEED_AGENTS[1], pendingFiles: undefined },
    ],
  });
}

describe("<ActionsPanel /> — Gate di sicurezza", () => {
  beforeEach(() => seed(true));

  it("conta le modifiche in attesa ed elenca l'agente che le ha", () => {
    render(<ActionsPanel />);
    expect(screen.getByText("1 in attesa")).toBeTruthy();
    expect(screen.getByRole("button", { name: new RegExp(SEED_AGENTS[0].name) })).toBeTruthy();
    expect(screen.getByText("2 file")).toBeTruthy();
  });

  it("senza modifiche dice che il gate è libero", () => {
    seed(false);
    render(<ActionsPanel />);
    expect(screen.getByText("Nessuna in attesa")).toBeTruthy();
    expect(screen.getByText(/Nessuna modifica da approvare/)).toBeTruthy();
  });

  it("aprire una modifica seleziona l'agente e apre Controllo sorgente", () => {
    render(<ActionsPanel />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(SEED_AGENTS[0].name) }));
    const s = useStore.getState();
    expect(s.selectedAgentId).toBe(SEED_AGENTS[0].id);
    expect(s.activity).toBe("scm");
    expect(s.leftOpen).toBe(true);
  });

  it("le scorciatoie aprono le viste vere e non scrivono eventi", () => {
    render(<ActionsPanel />);
    fireEvent.click(screen.getByRole("button", { name: /Cronologia task/ }));
    expect(useStore.getState().bottomTab).toBe("history");
    fireEvent.click(screen.getByRole("button", { name: /Log eventi/ }));
    expect(useStore.getState().bottomTab).toBe("eventlog");
    expect(useStore.getState().events).toHaveLength(0);
  });
});
