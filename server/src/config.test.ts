import { describe, expect, it } from "vitest";
import { envLockedChanges, envManagedForUi, envManagedKeys, publicStatus, resolveSettings } from "./config";

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

describe("campi gestiti dall'ambiente — la UI non può cambiarli", () => {
  it("sono solo quelli con una variabile impostata e non vuota", () => {
    const keys = envManagedKeys({ SAMS_TOKEN: "t", GITHUB_TOKEN: "", SAMS_OPEN_PRS: "false", PORT: "3000" });
    expect(keys.sort()).toEqual(["openPRs", "runtimeToken"]);
  });

  it("un cambio dalla UI su un campo gestito dall'ambiente viene segnalato", () => {
    // Il caso della revisione di sicurezza: l'owner "ruota" dalla UI un token rubato
    // impostato anche su Render; al riavvio tornerebbe valido quello vecchio.
    const current = resolveSettings({ GITHUB_TOKEN: "ghp_env" }, null);
    expect(envLockedChanges({ githubToken: "ghp_nuovo" }, current, ["githubToken"])).toEqual(["githubToken"]);
  });

  it("rimandare lo stesso valore non è un cambio (la UI rimanda sempre provider, repo…)", () => {
    const current = resolveSettings({ SAMS_PROVIDER: "openrouter", GITHUB_REPO: "a/b" }, null);
    const locked = envManagedKeys({ SAMS_PROVIDER: "openrouter", GITHUB_REPO: "a/b" });
    expect(envLockedChanges({ provider: "openrouter", githubRepo: "a/b", model: "x" }, current, locked)).toEqual([]);
  });

  it("i campi non gestiti dall'ambiente restano liberi", () => {
    const current = resolveSettings({}, null);
    expect(envLockedChanges({ model: "x", githubRepo: "c/d" }, current, [])).toEqual([]);
  });
});

describe("envManagedForUi — cosa vede l'owner nelle impostazioni", () => {
  it("elenca solo i campi modificabili dalla UI, mai quelli di sola sicurezza", () => {
    const keys = envManagedForUi({
      GITHUB_TOKEN: "g",
      SAMS_MODEL: "m",
      SAMS_TOKEN: "owner",
      SAMS_EDITOR_TOKEN: "editor",
      SAMS_READONLY_TOKEN: "ro",
      GITHUB_WEBHOOK_SECRET: "s",
      SAMS_MCP_SERVERS: "[]",
    });
    expect(keys.sort()).toEqual(["githubToken", "model"]);
  });
});

describe("publicStatus — risposta pubblica", () => {
  it("non dice quali variabili d'ambiente sono impostate", () => {
    expect(publicStatus()).not.toHaveProperty("envManaged");
  });
});
