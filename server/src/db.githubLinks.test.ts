import { describe, expect, it } from "vitest";
import { deleteGithubLink, getGithubLink, openDb, saveGithubLink, setGithubRepo } from "./db";

describe("github_links", () => {
  it("salva, sceglie la repo, ricollega e scollega", async () => {
    const db = await openDb(":memory:");
    expect(await getGithubLink(db, "u1")).toBeNull();

    await saveGithubLink(db, "u1", "mario", "v1:enc1", 1);
    expect(await getGithubLink(db, "u1")).toMatchObject({ login: "mario", tokenEnc: "v1:enc1", repo: "", baseBranch: "" });

    expect(await setGithubRepo(db, "u1", "mario/app", "dev", 2)).toBe(true);
    expect(await getGithubLink(db, "u1")).toMatchObject({ repo: "mario/app", baseBranch: "dev", updatedAt: 2 });

    // stesso account ricollegato: la repo scelta resta, il token cambia
    await saveGithubLink(db, "u1", "Mario", "v1:enc2", 3);
    expect(await getGithubLink(db, "u1")).toMatchObject({ login: "Mario", tokenEnc: "v1:enc2", repo: "mario/app", baseBranch: "dev" });

    // un account diverso: la repo si azzera
    await saveGithubLink(db, "u1", "luigi", "v1:enc3", 4);
    expect(await getGithubLink(db, "u1")).toMatchObject({ login: "luigi", repo: "", baseBranch: "" });

    await deleteGithubLink(db, "u1");
    expect(await getGithubLink(db, "u1")).toBeNull();
    await db.close();
  });

  it("scegliere la repo senza collegamento non crea nulla", async () => {
    const db = await openDb(":memory:");
    expect(await setGithubRepo(db, "nessuno", "a/b", "main")).toBe(false);
    expect(await getGithubLink(db, "nessuno")).toBeNull();
    await db.close();
  });
});
