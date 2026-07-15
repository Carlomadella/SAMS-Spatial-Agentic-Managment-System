import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const resendVerificationRemote = vi.fn();
vi.mock("../../lib/backend", () => ({
  resendVerificationRemote: () => resendVerificationRemote(),
}));

import { VerifyBanner } from "./VerifyBanner";

describe("<VerifyBanner />", () => {
  beforeEach(() => resendVerificationRemote.mockReset());

  it("avvisa che l'indirizzo non è confermato", () => {
    render(<VerifyBanner />);
    expect(screen.getByText(/non è ancora confermato/)).toBeTruthy();
  });

  it("rimanda il link e conferma l'invio", async () => {
    resendVerificationRemote.mockResolvedValue({ ok: true });
    render(<VerifyBanner />);
    fireEvent.click(screen.getByText("Rimanda il link"));
    await waitFor(() => expect(resendVerificationRemote).toHaveBeenCalled());
    expect(await screen.findByText(/Link inviato/)).toBeTruthy();
  });

  it("mostra l'errore se l'invio fallisce", async () => {
    resendVerificationRemote.mockResolvedValue({ ok: false, error: "Runtime non raggiungibile" });
    render(<VerifyBanner />);
    fireEvent.click(screen.getByText("Rimanda il link"));
    expect(await screen.findByText("Runtime non raggiungibile")).toBeTruthy();
  });
});
