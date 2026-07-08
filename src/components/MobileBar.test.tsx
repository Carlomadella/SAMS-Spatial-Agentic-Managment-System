import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileBar } from "./MobileBar";
import { useStore } from "../store/useStore";

describe("<MobileBar />", () => {
  beforeEach(() => {
    useStore.setState({ leftOpen: false, rightOpen: false, bottomOpen: false });
  });

  it("mostra i quattro comandi touch", () => {
    render(<MobileBar />);
    expect(screen.getByLabelText("Explorer")).toBeTruthy();
    expect(screen.getByLabelText("Scena")).toBeTruthy();
    expect(screen.getByLabelText("Inspector")).toBeTruthy();
    expect(screen.getByLabelText("Pannello")).toBeTruthy();
  });

  it("aprire l'Inspector apre il pannello destro e chiude il sinistro", () => {
    useStore.setState({ leftOpen: true });
    render(<MobileBar />);
    fireEvent.click(screen.getByLabelText("Inspector"));
    expect(useStore.getState().rightOpen).toBe(true);
    expect(useStore.getState().leftOpen).toBe(false);
  });

  it("i due drawer laterali si escludono a vicenda", () => {
    useStore.setState({ rightOpen: true });
    render(<MobileBar />);
    fireEvent.click(screen.getByLabelText("Explorer"));
    expect(useStore.getState().leftOpen).toBe(true);
    expect(useStore.getState().rightOpen).toBe(false);
  });

  it("'Scena' chiude entrambi i pannelli laterali", () => {
    useStore.setState({ leftOpen: true, rightOpen: true });
    render(<MobileBar />);
    fireEvent.click(screen.getByLabelText("Scena"));
    expect(useStore.getState().leftOpen).toBe(false);
    expect(useStore.getState().rightOpen).toBe(false);
  });
});
