import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PresenceRoster } from "./PresenceRoster";
import { useStore } from "../store/useStore";

describe("<PresenceRoster />", () => {
  beforeEach(() => {
    useStore.setState({ backendOnline: true, people: [], chatName: "Carlo" });
  });

  it("non mostra nulla quando il workspace non è condiviso (solo tu)", () => {
    useStore.setState({ people: ["Carlo"] });
    const { container } = render(<PresenceRoster />);
    expect(container.firstChild).toBeNull();
  });

  it("non mostra nulla quando offline", () => {
    useStore.setState({ backendOnline: false, people: ["Carlo", "Bea"] });
    const { container } = render(<PresenceRoster />);
    expect(container.firstChild).toBeNull();
  });

  it("mostra la fila di avatar quando ci sono almeno due persone", () => {
    useStore.setState({ people: ["Carlo", "Bea"] });
    render(<PresenceRoster />);
    expect(screen.getByText("nel workspace")).toBeTruthy();
    // iniziali: CA (tu) e BE
    expect(screen.getByText("CA")).toBeTruthy();
    expect(screen.getByText("BE")).toBeTruthy();
  });
});
