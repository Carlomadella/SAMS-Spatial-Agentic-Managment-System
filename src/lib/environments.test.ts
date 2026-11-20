import { describe, expect, it } from "vitest";
import { effectiveBranch, NO_ENV_BRANCHES, readEnvBranches } from "./environments";

describe("effectiveBranch", () => {
  const set = { dev: "develop", staging: "", prod: "main" };
  it("usa il branch dell'ambiente quando c'è", () => {
    expect(effectiveBranch("dev", set, "trunk")).toEqual({ branch: "develop", dedicated: true });
  });
  it("altrimenti il branch base del runtime", () => {
    expect(effectiveBranch("staging", set, "trunk")).toEqual({ branch: "trunk", dedicated: false });
  });
  it("niente runtime, niente branch", () => {
    expect(effectiveBranch("staging", NO_ENV_BRANCHES, "")).toEqual({ branch: "", dedicated: false });
  });
});

describe("readEnvBranches", () => {
  it("runtime vecchio senza campo → tutti vuoti", () => {
    expect(readEnvBranches(undefined)).toEqual(NO_ENV_BRANCHES);
  });
  it("tiene solo le stringhe dei tre ambienti", () => {
    expect(readEnvBranches({ dev: "d", staging: 3, prod: "p", qa: "x" })).toEqual({ dev: "d", staging: "", prod: "p" });
  });
});
