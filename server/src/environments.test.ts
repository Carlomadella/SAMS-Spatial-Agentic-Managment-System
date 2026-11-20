import { describe, expect, it } from "vitest";
import { envBaseBranch, envBranches, isValidBranchName } from "./environments";

const none = { devBranch: "", stagingBranch: "", prodBranch: "" };

describe("isValidBranchName — nomi di branch accettati", () => {
  it.each(["main", "develop", "release/1.0", "staging-eu", "feat_x.y"])("%s va bene", (b) => {
    expect(isValidBranchName(b)).toBe(true);
  });
  it.each(["", " main", "-main", "a..b", "a//b", "/main", "main/", "main.lock", "a b", "a~b", "a^b", "a:b", "a@{1}", "main.", "x".repeat(201)])(
    "%j è rifiutato",
    (b) => {
      expect(isValidBranchName(b)).toBe(false);
    },
  );
});

describe("envBaseBranch — l'ambiente del task diventa il branch base", () => {
  const s = { devBranch: "develop", stagingBranch: "staging", prodBranch: "main" };

  it("traduce ogni ambiente nel suo branch", () => {
    expect(envBaseBranch("dev", s)).toBe("develop");
    expect(envBaseBranch("staging", s)).toBe("staging");
    expect(envBaseBranch("prod", s)).toBe("main");
  });

  it("ambiente non configurato → null (vale il branch base solito)", () => {
    expect(envBaseBranch("dev", none)).toBeNull();
  });

  it("ambiente sconosciuto o non stringa → null", () => {
    expect(envBaseBranch("qa", s)).toBeNull();
    expect(envBaseBranch(undefined, s)).toBeNull();
    expect(envBaseBranch(42, s)).toBeNull();
  });

  it("un branch non valido (es. da variabile d'ambiente) non passa", () => {
    expect(envBaseBranch("dev", { ...none, devBranch: "bad..name" })).toBeNull();
  });
});

describe("envBranches — riassunto per la UI", () => {
  it("riporta i tre branch (vuoti se non impostati)", () => {
    expect(envBranches({ ...none, prodBranch: "main" })).toEqual({ dev: "", staging: "", prod: "main" });
  });
});

describe("contesto del task — l'ambiente cambia solo il branch base", () => {
  it("dentro il GitHub dell'utente, il branch dell'ambiente vince e repo/token restano suoi", async () => {
    const { runWithGithub, githubContext } = await import("./github");
    const ctx = runWithGithub({ repo: "mario/app", token: "t-mario", baseBranch: "main" }, () =>
      runWithGithub({ baseBranch: "develop" }, () => githubContext()),
    );
    expect(ctx).toEqual({ repo: "mario/app", token: "t-mario", baseBranch: "develop" });
  });
});
