import { describe, expect, it } from "vitest";
import { SAMS_REPO, decideTaskRepo, taskRepoList } from "./repoOverride";

const editor = { usesOwnGithub: false, isOwner: false, serverRepo: "acme/app" };

describe("decideTaskRepo", () => {
  it("senza override (o malformato) usa la repo normale", () => {
    expect(decideTaskRepo(undefined, editor, {})).toEqual({ ok: true, repo: null });
    expect(decideTaskRepo("non valida", editor, {})).toEqual({ ok: true, repo: null });
  });

  it("editor col token del server: SAMS e la repo del server sì, altre no", () => {
    expect(decideTaskRepo(SAMS_REPO, editor, {})).toEqual({ ok: true, repo: SAMS_REPO });
    expect(decideTaskRepo("acme/app", editor, {})).toEqual({ ok: true, repo: "acme/app" });
    const d = decideTaskRepo("acme/segreta", editor, {});
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.error).toContain("SAMS_TASK_REPOS");
  });

  it("le repo in SAMS_TASK_REPOS sono consentite (maiuscole indifferenti)", () => {
    expect(decideTaskRepo("Acme/Lib", editor, { SAMS_TASK_REPOS: "acme/lib, x/y" }).ok).toBe(true);
  });

  it("chi usa il proprio GitHub e l'owner non hanno limiti", () => {
    expect(decideTaskRepo("acme/segreta", { ...editor, usesOwnGithub: true }, {}).ok).toBe(true);
    expect(decideTaskRepo("acme/segreta", { ...editor, isOwner: true }, {}).ok).toBe(true);
  });

  it("taskRepoList toglie doppioni e voci non valide", () => {
    expect(taskRepoList("acme/app", { SAMS_TASK_REPOS: "acme/app, ,bad" })).toEqual(["acme/app", SAMS_REPO]);
  });
});
