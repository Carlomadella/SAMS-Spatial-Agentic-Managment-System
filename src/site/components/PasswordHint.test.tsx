import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MIN_PASSWORD, PasswordHint } from "./PasswordHint";

describe("<PasswordHint /> — il requisito si vede prima dell'errore", () => {
  it("campo vuoto: mostra la regola", () => {
    render(<PasswordHint id="h" value="" />);
    expect(screen.getByText(`Almeno ${MIN_PASSWORD} caratteri`)).toBeTruthy();
  });

  it("mentre scrivi: quanti caratteri mancano", () => {
    const { container } = render(<PasswordHint id="h" value="abc" />);
    expect(container.textContent).toContain(`3/${MIN_PASSWORD}`);
  });

  it("requisito rispettato: niente contatore, segno di spunta", () => {
    const { container } = render(<PasswordHint id="h" value={"x".repeat(MIN_PASSWORD)} />);
    expect(container.textContent).not.toContain("/");
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("stessa regola del server", () => {
    expect(MIN_PASSWORD).toBe(8);
  });
});
