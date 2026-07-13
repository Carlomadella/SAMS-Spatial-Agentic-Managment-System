import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoomEditBanner } from "./RoomEditBanner";
import { useStore } from "../store/useStore";

describe("<RoomEditBanner />", () => {
  beforeEach(() => {
    useStore.setState({ roomEditMode: false, furniturePlacements: {} });
  });

  it("non renderizza nulla fuori dalla modalità riordino", () => {
    const { container } = render(<RoomEditBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("in modalità riordino mostra l'istruzione e il pulsante Fatto", () => {
    useStore.setState({ roomEditMode: true });
    render(<RoomEditBanner />);
    expect(screen.getByText(/Trascina i mobili/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fatto" })).toBeTruthy();
    // niente Reset se nessun mobile è stato spostato
    expect(screen.queryByRole("button", { name: /Reset/ })).toBeNull();
  });

  it("mostra Reset col conteggio quando ci sono mobili spostati", () => {
    useStore.setState({ roomEditMode: true, furniturePlacements: { "bed-0": { dx: 2, dz: 0 }, sofa: { dx: 0, dz: 0 } } });
    render(<RoomEditBanner />);
    // solo bed-0 è davvero spostato (sofa dx/dz nulli non conta)
    expect(screen.getByRole("button", { name: /Reset \(1\)/ })).toBeTruthy();
  });
});
