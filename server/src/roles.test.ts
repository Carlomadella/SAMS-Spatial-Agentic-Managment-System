import { describe, expect, it } from "vitest";
import { bearerToken, resolveRole, roleAtLeast, type RoleTokens } from "./roles";

const tokens = (o: Partial<RoleTokens>): RoleTokens => ({ owner: "", editor: "", viewer: "", ...o });

describe("bearerToken", () => {
  it("estrae il token da un header Bearer valido", () => {
    expect(bearerToken("Bearer abc123")).toBe("abc123");
    expect(bearerToken("  Bearer  spaced  ")).toBe("spaced");
  });
  it("ritorna vuoto per header assenti o malformati", () => {
    expect(bearerToken(undefined)).toBe("");
    expect(bearerToken(null)).toBe("");
    expect(bearerToken("")).toBe("");
    expect(bearerToken("Basic abc")).toBe("");
    expect(bearerToken("abc")).toBe("");
  });
});

describe("resolveRole", () => {
  it("nessun token configurato → owner (dev aperto, retro-compatibile)", () => {
    expect(resolveRole(tokens({}), "")).toBe("owner");
    expect(resolveRole(tokens({}), "qualsiasi")).toBe("owner");
  });

  it("matcha il tier corretto per token", () => {
    const t = tokens({ owner: "O", editor: "E", viewer: "V" });
    expect(resolveRole(t, "O")).toBe("owner");
    expect(resolveRole(t, "E")).toBe("editor");
    expect(resolveRole(t, "V")).toBe("viewer");
  });

  it("token configurato ma non combaciante → viewer", () => {
    expect(resolveRole(tokens({ owner: "O" }), "sbagliato")).toBe("viewer");
    expect(resolveRole(tokens({ owner: "O" }), "")).toBe("viewer");
  });

  it("owner ha precedenza se più tier condividono lo stesso token", () => {
    expect(resolveRole(tokens({ owner: "X", editor: "X" }), "X")).toBe("owner");
  });

  it("un tier con token vuoto non fa mai match", () => {
    // solo owner configurato: un provided vuoto non deve diventare editor/viewer per errore
    expect(resolveRole(tokens({ owner: "O" }), "")).toBe("viewer");
    // solo editor configurato: il token owner vuoto non matcha un provided vuoto
    expect(resolveRole(tokens({ editor: "E" }), "E")).toBe("editor");
    expect(resolveRole(tokens({ editor: "E" }), "")).toBe("viewer");
  });
});

describe("roleAtLeast", () => {
  it("rispetta la gerarchia viewer < editor < owner", () => {
    expect(roleAtLeast("owner", "editor")).toBe(true);
    expect(roleAtLeast("owner", "owner")).toBe(true);
    expect(roleAtLeast("editor", "editor")).toBe(true);
    expect(roleAtLeast("editor", "owner")).toBe(false);
    expect(roleAtLeast("viewer", "editor")).toBe(false);
    expect(roleAtLeast("viewer", "viewer")).toBe(true);
  });
});
