import { describe, expect, it } from "vitest";
import { allowedWorkflows, decideWorkflow } from "./workflowGuard";

const task = { branch: "sams/blue/fix", baseBranch: "main", mustStage: false };

describe("decideWorkflow", () => {
  it("sul branch del task, senza approvazione e senza lista: parte", () => {
    expect(decideWorkflow({ workflow: "ci.yml", ref: "sams/blue/fix" }, task, {})).toEqual({ kind: "run" });
  });

  it("mai sul branch base", () => {
    const d = decideWorkflow({ workflow: "ci.yml", ref: "main" }, task, {});
    expect(d.kind).toBe("refuse");
  });

  it("mai su un altro branch che non è quello del task", () => {
    const d = decideWorkflow({ workflow: "deploy.yml", ref: "release" }, task, {});
    expect(d).toMatchObject({ kind: "refuse" });
    if (d.kind === "refuse") expect(d.reason).toContain("sams/blue/fix");
  });

  it("task sul branch principale: rifiutato anche con ref uguale", () => {
    const d = decideWorkflow({ workflow: "ci.yml", ref: "main" }, { branch: "main", baseBranch: "main", mustStage: true }, {});
    expect(d.kind).toBe("refuse");
  });

  it("base reale diverso da quello delle impostazioni: il task su quel base è rifiutato", () => {
    const d = decideWorkflow({ workflow: "ci.yml", ref: "develop" }, { branch: "develop", baseBranch: "develop", mustStage: false, protectedBranches: ["main"] }, {});
    expect(d.kind).toBe("refuse");
  });

  it("mai sui branch degli ambienti, anche se fossero il branch del task", () => {
    const d = decideWorkflow({ workflow: "ci.yml", ref: "staging" }, { branch: "staging", baseBranch: "main", mustStage: false, protectedBranches: ["main", "develop", "staging", ""] }, {});
    expect(d.kind).toBe("refuse");
  });

  it("con l'approvazione obbligatoria resta in attesa", () => {
    expect(decideWorkflow({ workflow: "ci.yml", ref: "sams/blue/fix" }, { ...task, mustStage: true }, {})).toEqual({ kind: "defer" });
  });

  it("con SAMS_WORKFLOWS solo quelli in lista (nome o percorso)", () => {
    const env = { SAMS_WORKFLOWS: "ci.yml, test.yml" };
    expect(decideWorkflow({ workflow: "deploy.yml", ref: "sams/blue/fix" }, task, env).kind).toBe("refuse");
    expect(decideWorkflow({ workflow: ".github/workflows/CI.yml", ref: "sams/blue/fix" }, task, env).kind).toBe("run");
  });

  it("allowedWorkflows ignora voci vuote", () => {
    expect(allowedWorkflows({ SAMS_WORKFLOWS: " a.yml ,, b.yml " })).toEqual(["a.yml", "b.yml"]);
    expect(allowedWorkflows({})).toEqual([]);
  });
});
