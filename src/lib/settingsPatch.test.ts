import { describe, expect, it } from "vitest";
import { withoutLocked } from "./settingsPatch";

// Ultrareview 2026-11-11: con SAMS_MODEL bloccato dall'ambiente, cambiare provider cambiava
// anche il modello; il salvataggio mandava il campo bloccato e tornava 409 ogni volta.
describe("withoutLocked", () => {
  it("toglie dalla patch i campi gestiti dall'ambiente", () => {
    const patch = { provider: "groq", model: "llama", openPRs: false };
    expect(withoutLocked(patch, new Set(["model"]))).toEqual({ provider: "groq", openPRs: false });
  });

  it("senza campi bloccati la patch resta uguale", () => {
    const patch = { provider: "groq", model: "llama" };
    expect(withoutLocked(patch, new Set())).toEqual(patch);
  });
});
