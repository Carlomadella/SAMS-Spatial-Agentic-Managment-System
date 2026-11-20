import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Terminal } from "./Terminal";
import { useStore } from "../store/useStore";

function run(cmd: string) {
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: cmd } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("<Terminal /> — assign senza GitHub", () => {
  // jsdom non implementa scrollTo sugli elementi (il terminale scorre in fondo a ogni riga).
  beforeAll(() => {
    Element.prototype.scrollTo = () => {};
  });
  afterEach(() => useStore.setState({ backendOnline: false, toolsReady: null }));

  it("non assegna e spiega cosa manca", () => {
    useStore.setState({ backendOnline: true, toolsReady: false, githubAccount: null, viewerRole: "owner" });
    const agent = useStore.getState().agents[0];
    render(<Terminal />);
    run(`assign ${agent.name} scrivi i test`);
    expect(screen.getByText(/non hanno strumenti/)).toBeTruthy();
    expect(useStore.getState().agents.find((a) => a.id === agent.id)?.task?.title).not.toBe("scrivi i test");
  });
});
