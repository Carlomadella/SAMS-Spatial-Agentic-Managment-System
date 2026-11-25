import { describe, expect, it } from "vitest";
import { shortValue, versionSummary, type AgentVersion } from "./agentVersions";

const v = (over: Partial<AgentVersion> = {}): AgentVersion => ({ n: 2, config: {}, createdBy: "Carlo", createdAt: 0, note: "", changes: [], ...over });

describe("versioni — testi", () => {
  it("riassunto della riga", () => {
    expect(versionSummary(v({ n: 1 }), true)).toBe("Creato");
    expect(versionSummary(v({ changes: [{ field: "model", label: "Modello", before: "a", after: "b" }, { field: "instructions", label: "Istruzioni", before: "", after: "x" }] }), false)).toBe("Cambiati: Modello, Istruzioni");
    expect(versionSummary(v({ note: "ripristino della versione 3" }), false)).toBe("Ripristino della versione 3");
  });

  it("valori brevi", () => {
    expect(shortValue("  ")).toBe("(vuoto)");
    expect(shortValue("x".repeat(200), 10)).toBe("xxxxxxxxx…");
  });
});
