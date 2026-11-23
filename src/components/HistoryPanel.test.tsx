import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("../lib/backend", () => ({
  fetchHistory: vi.fn(async () => [
    { agentId: "a1", agentName: "Blue", title: "Leggi il README", branch: "", status: "done", tokens: 0, ts: 1, summary: "Proposta completa per il README" },
    { agentId: "a2", agentName: "Green", title: "Senza riassunto", branch: "", status: "done", tokens: 0, ts: 2, summary: "" },
  ]),
}));

import { HistoryPanel } from "./HistoryPanel";

// Collaudo 21/11, punto 1: la riga del task in Cronologia non si apriva.
describe("HistoryPanel — risultato del task", () => {
  it("cliccando la riga si apre il risultato completo, e si richiude", async () => {
    render(<HistoryPanel />);
    const row = await screen.findByRole("button", { name: /Leggi il README/ });
    expect(screen.queryByText("Proposta completa per il README")).toBeNull();
    fireEvent.click(row);
    expect(screen.getByText("Proposta completa per il README")).toBeTruthy();
    fireEvent.click(row);
    expect(screen.queryByText("Proposta completa per il README")).toBeNull();
  });

  it("una riga senza riassunto non è cliccabile", async () => {
    render(<HistoryPanel />);
    await screen.findByText("Senza riassunto");
    expect(screen.queryByRole("button", { name: /Senza riassunto/ })).toBeNull();
  });
});
