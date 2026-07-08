import { describe, it, expect } from "vitest";
import { normalizeRole, roleAtLeast, canAssign, canConfigure, roleMeta } from "./roleUi";

describe("roleUi", () => {
  it("normalizza i ruoli validi e ripiega su owner (dev aperto)", () => {
    expect(normalizeRole("viewer")).toBe("viewer");
    expect(normalizeRole("editor")).toBe("editor");
    expect(normalizeRole("owner")).toBe("owner");
    expect(normalizeRole("boh")).toBe("owner");
    expect(normalizeRole(undefined)).toBe("owner");
    expect(normalizeRole(null)).toBe("owner");
  });

  it("roleAtLeast rispetta la gerarchia viewer < editor < owner", () => {
    expect(roleAtLeast("owner", "editor")).toBe(true);
    expect(roleAtLeast("editor", "editor")).toBe(true);
    expect(roleAtLeast("viewer", "editor")).toBe(false);
    expect(roleAtLeast("editor", "owner")).toBe(false);
    expect(roleAtLeast("viewer", "viewer")).toBe(true);
  });

  it("canAssign: editor e owner sì, viewer no", () => {
    expect(canAssign("owner")).toBe(true);
    expect(canAssign("editor")).toBe(true);
    expect(canAssign("viewer")).toBe(false);
  });

  it("canConfigure: solo owner", () => {
    expect(canConfigure("owner")).toBe(true);
    expect(canConfigure("editor")).toBe(false);
    expect(canConfigure("viewer")).toBe(false);
  });

  it("roleMeta espone etichetta/icona/tooltip per ogni ruolo", () => {
    for (const r of ["owner", "editor", "viewer"] as const) {
      const m = roleMeta(r);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.icon.length).toBeGreaterThan(0);
      expect(m.title).toContain("—");
    }
    expect(roleMeta("viewer").label).toBe("Sola lettura");
  });
});
