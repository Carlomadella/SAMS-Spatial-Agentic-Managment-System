import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TaskResultBox } from "./TaskResultBox";

describe("TaskResultBox", () => {
  it("mostra il risultato breve per intero, con il titolo del task", () => {
    render(<TaskResultBox result={{ title: "Leggi il README", summary: "Proposta: una sezione Installazione.", ts: Date.now() }} />);
    expect(screen.getByText("Proposta: una sezione Installazione.")).toBeTruthy();
    expect(screen.getByText(/Leggi il README/)).toBeTruthy();
    expect(screen.queryByText("Mostra tutto")).toBeNull();
  });

  it("un risultato lungo parte chiuso e si apre con «Mostra tutto»", () => {
    const long = "a".repeat(700) + "FINE";
    render(<TaskResultBox result={{ title: "T", summary: long, ts: Date.now() }} />);
    expect(screen.queryByText(/FINE/)).toBeNull();
    fireEvent.click(screen.getByText("Mostra tutto"));
    expect(screen.getByText(/FINE/)).toBeTruthy();
  });
});
