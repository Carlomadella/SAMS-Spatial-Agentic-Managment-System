import { describe, expect, it } from "vitest";
import { CHOICE_KEYS, SECRET_KEYS, decodeChoices, encodeChoices, envLockedChanges, envManagedForUi, envManagedKeys, ephemeralDisk, ephemeralWithoutDb, publicStatus, resolveSettings, scrubEnvCopies, secretChanges, secretEnvName, settingsToPersist } from "./config";

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

// Ultrareview 2026-11-11: persist() scriveva nel file anche i valori presi dall'ambiente. Svuotata la
// variabile (revoca), il vecchio token tornava dal file — che ora sta su un disco persistente.
describe("settingsToPersist — il file non riceve i valori dell'ambiente", () => {
  it("un token dall'ambiente non finisce nel file", () => {
    const env = { SAMS_TOKEN: "owner-env" };
    const current = resolveSettings(env, { githubRepo: "me/repo" });
    const data = settingsToPersist(current, { githubRepo: "me/repo" }, env);
    expect(data).not.toHaveProperty("runtimeToken");
    expect(data.githubRepo).toBe("me/repo");
    expect(data).not.toHaveProperty("port");
  });

  it("per un campo gestito dall'ambiente resta il valore che il file aveva già", () => {
    const env = { GITHUB_TOKEN: "ghp_env" };
    const stored = { githubToken: "ghp_ui" };
    const data = settingsToPersist(resolveSettings(env, stored), stored, env);
    expect(data.githubToken).toBe("ghp_ui");
  });

  it("revoca: svuotata la variabile, il token dell'ambiente non torna", () => {
    const env = { SAMS_TOKEN: "vecchio" };
    const data = settingsToPersist(resolveSettings(env, null), {}, env);
    const dopo = resolveSettings({}, data);
    expect(dopo.runtimeToken).toBe("");
  });

  it("i campi non gestiti dall'ambiente si salvano dal valore corrente (scelte della UI)", () => {
    const current = { ...resolveSettings({}, null), model: "x/y:free", openPRs: false };
    const data = settingsToPersist(current, {}, {});
    expect(data.model).toBe("x/y:free");
    expect(data.openPRs).toBe(false);
  });
});

describe("scrubEnvCopies — pulizia dei file scritti dalla versione precedente", () => {
  it("toglie i campi uguali alla variabile d'ambiente (erano copie)", () => {
    const { cleaned, dropped } = scrubEnvCopies({ runtimeToken: "tok", githubRepo: "me/r" }, { SAMS_TOKEN: "tok" });
    expect(cleaned).toEqual({ githubRepo: "me/r" });
    expect(dropped).toEqual(["runtimeToken"]);
  });

  it("lascia un valore diverso da quello dell'ambiente (scelto dalla UI prima del blocco)", () => {
    const { cleaned, dropped } = scrubEnvCopies({ githubToken: "ghp_ui" }, { GITHUB_TOKEN: "ghp_env" });
    expect(cleaned).toEqual({ githubToken: "ghp_ui" });
    expect(dropped).toEqual([]);
  });
});

describe("variabili d'ambiente con spazi", () => {
  it("si leggono senza spazi in testa o in coda", () => {
    expect(resolveSettings({ SAMS_MODEL: "  x/y:free \n" }, null).model).toBe("x/y:free");
  });

  it("una variabile di soli spazi conta come non impostata", () => {
    expect(resolveSettings({ GITHUB_TOKEN: "   " }, { githubToken: "ghp_file" }).githubToken).toBe("ghp_file");
    expect(envManagedKeys({ GITHUB_TOKEN: "   " })).not.toContain("githubToken");
  });
});

describe("opzione C — scelte nel database, segreti fuori", () => {
  it("segreti e scelte coprono tutti i 21 campi salvabili, senza sovrapporsi", () => {
    const all = Object.keys(resolveSettings({}, null)).filter((k) => k !== "port").sort();
    expect([...SECRET_KEYS, ...CHOICE_KEYS].sort()).toEqual(all);
    expect(SECRET_KEYS).toHaveLength(12);
    expect(CHOICE_KEYS).toHaveLength(9);
  });

  it("encode/decode delle scelte: andata e ritorno, segreti esclusi", () => {
    const rows = encodeChoices({ provider: "openrouter", model: "m", openPRs: false, githubToken: "ghp_x" } as never);
    expect(rows).not.toHaveProperty("githubToken");
    expect(decodeChoices(rows)).toEqual({ provider: "openrouter", model: "m", openPRs: false });
  });

  it("decode ignora righe corrotte, sconosciute o del tipo sbagliato", () => {
    expect(
      decodeChoices({ provider: '"nessuno"', openPRs: '"si"', model: "{rotto", githubToken: '"ghp"', baseBranch: '"dev"' }),
    ).toEqual({ baseBranch: "dev" });
  });

  it("SAMS_EPHEMERAL_DISK: vero solo se impostato a un valore affermativo", () => {
    expect(ephemeralDisk({})).toBe(false);
    expect(ephemeralDisk({ SAMS_EPHEMERAL_DISK: "1" })).toBe(true);
    expect(ephemeralDisk({ SAMS_EPHEMERAL_DISK: " true " })).toBe(true);
    expect(ephemeralDisk({ SAMS_EPHEMERAL_DISK: "0" })).toBe(false);
    expect(ephemeralDisk({ SAMS_EPHEMERAL_DISK: "false" })).toBe(false);
  });

  it("secretChanges trova solo i segreti cambiati, e il nome della variabile da impostare", () => {
    const cur = resolveSettings({}, { openrouterApiKey: "sk-1" });
    expect(secretChanges({ openrouterApiKey: "sk-1", model: "x" }, cur)).toEqual([]);
    expect(secretChanges({ openrouterApiKey: "sk-2", githubToken: "g" }, cur)).toEqual(["openrouterApiKey", "githubToken"]);
    expect(secretEnvName("openrouterApiKey")).toBe("OPENROUTER_API_KEY");
    expect(secretEnvName("runtimeToken")).toBe("SAMS_TOKEN");
  });

  it("disco effimero senza SAMS_DB_URL: il server non deve partire", () => {
    expect(ephemeralWithoutDb({ SAMS_EPHEMERAL_DISK: "1" })).toBe(true);
    expect(ephemeralWithoutDb({ SAMS_EPHEMERAL_DISK: "1", SAMS_DB_URL: "  " })).toBe(true);
    expect(ephemeralWithoutDb({ SAMS_EPHEMERAL_DISK: "1", SAMS_DB_URL: "mysql://u:p@h:3306/db" })).toBe(false);
    expect(ephemeralWithoutDb({})).toBe(false);
  });
});
