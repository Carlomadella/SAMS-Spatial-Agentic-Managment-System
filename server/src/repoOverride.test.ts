import { describe, expect, it } from "vitest";
import { SAMS_REPO, decideTaskRepo } from "./repoOverride";

describe("decideTaskRepo — solo la repo selezionata (25/11)", () => {
  it("senza override (o malformato) usa la repo selezionata", () => {
    expect(decideTaskRepo(undefined, "acme/app")).toEqual({ ok: true, repo: null });
    expect(decideTaskRepo("non valida", "acme/app")).toEqual({ ok: true, repo: null });
  });

  it("la repo selezionata va bene (maiuscole indifferenti)", () => {
    expect(decideTaskRepo("Acme/App", "acme/app")).toEqual({ ok: true, repo: null });
  });

  it("il meta-agente può lavorare sulla repo di SAMS", () => {
    expect(decideTaskRepo(SAMS_REPO, "acme/app")).toEqual({ ok: true, repo: SAMS_REPO });
    expect(decideTaskRepo(SAMS_REPO.toLowerCase(), "acme/app")).toEqual({ ok: true, repo: SAMS_REPO });
  });

  it("qualsiasi altra repo no, per tutti (anche owner e chi usa il proprio GitHub)", () => {
    const d = decideTaskRepo("acme/segreta", "acme/app");
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.error).toContain("solo sulla repo selezionata (acme/app)");
      expect(d.error).toContain("meta-agente");
    }
    expect(decideTaskRepo("acme/segreta", "").ok).toBe(false);
  });
});
