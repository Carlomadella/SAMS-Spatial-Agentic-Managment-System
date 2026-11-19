import { describe, expect, it } from "vitest";
import { canonicalRole } from "./agentRoles";

// Collaudo sim-prenota-sale: gli agenti iniziali del mondo salvato avevano ruoli
// vecchi (Backend, QA, Reviewer, Workflows, DevOps) che server e inspector non
// riconoscevano.
describe("canonicalRole", () => {
  it("traduce i ruoli vecchi nel ruolo equivalente", () => {
    expect(canonicalRole("Backend")).toBe("Generalist");
    expect(canonicalRole("DevOps")).toBe("Generalist");
    expect(canonicalRole("Workflows")).toBe("Generalist");
    expect(canonicalRole("QA")).toBe("Tester");
    expect(canonicalRole("Reviewer")).toBe("Revisore");
  });
  it("lascia invariati i ruoli già validi e quelli sconosciuti", () => {
    expect(canonicalRole("Architetto")).toBe("Architetto");
    expect(canonicalRole(" tester ")).toBe("Tester");
    expect(canonicalRole("Astronauta")).toBe("Astronauta");
  });
});
