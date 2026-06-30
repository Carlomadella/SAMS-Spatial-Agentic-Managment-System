import { describe, it, expect } from "vitest";
import { SAMS_REPO, META_IDEAS, metaRepo, slugifyBranch, buildMetaTask } from "./metaAgent";

describe("metaRepo", () => {
  it("punta a SAMS quando l'agente è meta", () => {
    expect(metaRepo({ meta: true })).toBe(SAMS_REPO);
  });
  it("non override (undefined) per un agente normale", () => {
    expect(metaRepo({ meta: false })).toBeUndefined();
    expect(metaRepo({})).toBeUndefined();
  });
});

describe("slugifyBranch", () => {
  it("normalizza spazi, maiuscole e accenti", () => {
    expect(slugifyBranch("Migliora però l'Accessibilità")).toBe("migliora-pero-l-accessibilita");
  });
  it("non lascia trattini iniziali/finali", () => {
    expect(slugifyBranch("  --ciao!!  ")).toBe("ciao");
  });
  it("tronca a una lunghezza ragionevole senza trattino finale", () => {
    const s = slugifyBranch("x".repeat(50));
    expect(s.length).toBeLessThanOrEqual(32);
    expect(s.endsWith("-")).toBe(false);
  });
  it("ripiega su 'miglioria' quando il testo non ha caratteri utili", () => {
    expect(slugifyBranch("!!!")).toBe("miglioria");
  });
});

describe("buildMetaTask", () => {
  it("produce titolo prefissato [SAMS] e branch sotto sams/meta-", () => {
    const idea = META_IDEAS[0];
    const { title, branch } = buildMetaTask(idea);
    expect(title.startsWith("[SAMS] ")).toBe(true);
    expect(title).toContain(idea.brief);
    expect(branch).toBe(`sams/meta-${idea.id}`);
  });
});

describe("META_IDEAS", () => {
  it("ha spunti con id univoci e tutti i campi", () => {
    const ids = META_IDEAS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of META_IDEAS) {
      expect(i.id).toBeTruthy();
      expect(i.label).toBeTruthy();
      expect(i.brief.length).toBeGreaterThan(20);
    }
  });
});
