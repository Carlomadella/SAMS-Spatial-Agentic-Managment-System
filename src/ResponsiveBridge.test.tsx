import { afterEach, describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import { ResponsiveBridge } from "./Workspace";
import { useStore } from "./store/useStore";

function setWidth(w: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: w });
  window.dispatchEvent(new Event("resize"));
}

describe("ResponsiveBridge: pannelli e fascia mobile", () => {
  afterEach(() => setWidth(1440));

  it("chiude i pannelli entrando in mobile e li rimette com'erano tornando su desktop", () => {
    setWidth(1440);
    useStore.setState({ leftOpen: true, rightOpen: false });
    render(<ResponsiveBridge />);
    act(() => setWidth(600));
    expect(useStore.getState().leftOpen).toBe(false);
    expect(useStore.getState().rightOpen).toBe(false);
    act(() => setWidth(1440));
    expect(useStore.getState().leftOpen).toBe(true);
    expect(useStore.getState().rightOpen).toBe(false);
  });

  it("aperto già in mobile, su desktop si torna coi pannelli aperti", () => {
    setWidth(390);
    useStore.setState({ leftOpen: false, rightOpen: false });
    render(<ResponsiveBridge />);
    act(() => setWidth(1440));
    expect(useStore.getState().leftOpen).toBe(true);
    expect(useStore.getState().rightOpen).toBe(true);
  });
});
