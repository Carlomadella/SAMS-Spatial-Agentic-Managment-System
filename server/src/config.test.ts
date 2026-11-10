import { describe, expect, it } from "vitest";
import { resolveSettings } from "./config";

describe("resolveSettings — precedenza ambiente > file > default", () => {
  it("una variabile d'ambiente vince sul file salvato (anche se il file ha un valore vuoto)", () => {
    // Il bug del collaudo 2026-11-10: SAMS_TOKEN impostato su Render veniva ignorato
    // perché .sams-runtime.json conteneva runtimeToken: "".
    const s = resolveSettings(
      { SAMS_TOKEN: "owner-env", OPENROUTER_API_KEY: "sk-env", SAMS_PROVIDER: "openrouter" },
      { runtimeToken: "", openrouterApiKey: "sk-file", provider: "gemini" },
    );
    expect(s.runtimeToken).toBe("owner-env");
    expect(s.openrouterApiKey).toBe("sk-env");
    expect(s.provider).toBe("openrouter");
  });

  it("il file riempie ciò che l'ambiente non dice (scelte fatte dalla UI)", () => {
    const s = resolveSettings({}, { githubRepo: "me/repo", model: "qwen/x:free", requireApproval: true });
    expect(s.githubRepo).toBe("me/repo");
    expect(s.model).toBe("qwen/x:free");
    expect(s.requireApproval).toBe(true);
  });

  it("una variabile vuota non cancella il valore del file", () => {
    const s = resolveSettings({ GITHUB_TOKEN: "" }, { githubToken: "ghp_file" });
    expect(s.githubToken).toBe("ghp_file");
  });

  it("i booleani dall'ambiente vincono sul file", () => {
    const s = resolveSettings({ SAMS_OPEN_PRS: "false", SAMS_REQUIRE_APPROVAL: "true" }, { openPRs: true, requireApproval: false });
    expect(s.openPRs).toBe(false);
    expect(s.requireApproval).toBe(true);
  });

  it("senza ambiente né file restano i default", () => {
    const s = resolveSettings({}, null);
    expect(s.provider).toBe("gemini");
    expect(s.baseBranch).toBe("main");
    expect(s.openPRs).toBe(true);
    expect(s.requireApproval).toBe(false);
    expect(s.runtimeToken).toBe("");
    expect(s.port).toBe(8787);
  });

  it("la porta viene solo dall'ambiente, mai dal file", () => {
    expect(resolveSettings({ PORT: "3000" }, { port: 1234 } as never).port).toBe(3000);
    expect(resolveSettings({}, { port: 1234 } as never).port).toBe(8787);
  });
});
