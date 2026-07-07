import { describe, it, expect } from "vitest";
import {
  SAMS_REPO,
  META_IDEAS,
  isValidRepo,
  metaRepo,
  resolveTaskRepo,
  slugifyBranch,
  buildMetaTask,
  shouldProposeMeta,
  pickMetaIdea,
  META_PROPOSAL_COOLDOWN_MS,
  type MetaCandidate,
} from "./metaAgent";

describe("isValidRepo", () => {
  it("accetta owner/repo e rifiuta il resto", () => {
    expect(isValidRepo("acme/widgets")).toBe(true);
    expect(isValidRepo("  a.b-c/d_e.f  ")).toBe(true);
    expect(isValidRepo("solo-owner")).toBe(false);
    expect(isValidRepo("a/b/c")).toBe(false);
    expect(isValidRepo("")).toBe(false);
    expect(isValidRepo(undefined)).toBe(false);
  });
});

describe("metaRepo", () => {
  it("punta a SAMS quando l'agente è meta", () => {
    expect(metaRepo({ meta: true })).toBe(SAMS_REPO);
  });
  it("non override (undefined) per un agente normale", () => {
    expect(metaRepo({ meta: false })).toBeUndefined();
    expect(metaRepo({})).toBeUndefined();
  });
  it("usa l'override per-agente valido, anche sopra al meta", () => {
    expect(metaRepo({ repo: "acme/widgets" })).toBe("acme/widgets");
    expect(metaRepo({ meta: true, repo: "acme/widgets" })).toBe("acme/widgets");
  });
  it("ignora un override non valido (ricade su meta/globale)", () => {
    expect(metaRepo({ repo: "non-valido" })).toBeUndefined();
    expect(metaRepo({ meta: true, repo: "  " })).toBe(SAMS_REPO);
  });
});

describe("resolveTaskRepo", () => {
  it("l'override per-task valido vince su tutto", () => {
    expect(resolveTaskRepo({}, "acme/widgets")).toBe("acme/widgets");
    expect(resolveTaskRepo({ meta: true }, "acme/widgets")).toBe("acme/widgets");
    expect(resolveTaskRepo({ repo: "team/repo" }, "acme/widgets")).toBe("acme/widgets");
  });
  it("senza override per-task ricade sulla risoluzione per-agente (metaRepo)", () => {
    expect(resolveTaskRepo({ meta: true })).toBe(SAMS_REPO);
    expect(resolveTaskRepo({ repo: "team/repo" })).toBe("team/repo");
    expect(resolveTaskRepo({})).toBeUndefined();
  });
  it("ignora un override per-task non valido e ricade sull'agente", () => {
    expect(resolveTaskRepo({ repo: "team/repo" }, "non-valido")).toBe("team/repo");
    expect(resolveTaskRepo({ meta: true }, "  ")).toBe(SAMS_REPO);
    expect(resolveTaskRepo({}, "solo-owner")).toBeUndefined();
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

describe("shouldProposeMeta", () => {
  const base: MetaCandidate = { meta: true, status: "idle", task: null, taskQueue: [] };
  const now = 1_000_000;

  it("propone quando il meta-agente è libero e il cooldown è scaduto", () => {
    expect(shouldProposeMeta(base, undefined, now)).toBe(true);
    expect(shouldProposeMeta(base, now - META_PROPOSAL_COOLDOWN_MS, now)).toBe(true);
  });

  it("non propone a un agente non-meta o occupato", () => {
    expect(shouldProposeMeta({ ...base, meta: false }, undefined, now)).toBe(false);
    expect(shouldProposeMeta({ ...base, status: "working" }, undefined, now)).toBe(false);
    expect(shouldProposeMeta({ ...base, task: { title: "x" } }, undefined, now)).toBe(false);
    expect(shouldProposeMeta({ ...base, taskQueue: [{}] }, undefined, now)).toBe(false);
  });

  it("rispetta il cooldown dall'ultima proposta", () => {
    expect(shouldProposeMeta(base, now - 1000, now)).toBe(false);
  });
});

describe("pickMetaIdea", () => {
  it("ruota in modo deterministico e gestisce seed negativi", () => {
    expect(pickMetaIdea(META_IDEAS, 0)).toBe(META_IDEAS[0]);
    expect(pickMetaIdea(META_IDEAS, META_IDEAS.length)).toBe(META_IDEAS[0]);
    expect(pickMetaIdea(META_IDEAS, 1)).toBe(META_IDEAS[1]);
    expect(pickMetaIdea(META_IDEAS, -1)).toBe(META_IDEAS[META_IDEAS.length - 1]);
  });
});
