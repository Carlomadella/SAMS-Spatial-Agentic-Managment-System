import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyGithubSignature, parseGithubEvent } from "./webhook";

const sign = (secret: string, body: string) =>
  "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");

describe("verifyGithubSignature", () => {
  it("accetta una firma valida", () => {
    const body = '{"a":1}';
    expect(verifyGithubSignature("topsecret", body, sign("topsecret", body))).toBe(true);
  });
  it("rifiuta una firma errata o di un segreto diverso", () => {
    const body = '{"a":1}';
    expect(verifyGithubSignature("topsecret", body, sign("altro", body))).toBe(false);
    expect(verifyGithubSignature("topsecret", body, "sha256=deadbeef")).toBe(false);
    expect(verifyGithubSignature("topsecret", body, undefined)).toBe(false);
    expect(verifyGithubSignature("topsecret", body, "md5=xxx")).toBe(false);
  });
  it("disabilita la verifica con segreto vuoto", () => {
    expect(verifyGithubSignature("", "qualsiasi", undefined)).toBe(true);
  });
});

describe("parseGithubEvent", () => {
  it("riassume un push", () => {
    const r = parseGithubEvent("push", {
      ref: "refs/heads/main",
      pusher: { name: "carlo" },
      commits: [{}, {}],
      repository: { full_name: "x/y" },
    });
    expect(r?.level).toBe("INFO");
    expect(r?.message).toContain("x/y/main");
    expect(r?.message).toContain("2 commits");
    expect(r?.wake).toBeUndefined();
  });

  it("riconosce una PR aperta e ignora azioni non interessanti", () => {
    expect(parseGithubEvent("pull_request", { action: "opened", pull_request: { number: 7, title: "Feat" } })?.level).toBe("SUCCESS");
    expect(parseGithubEvent("pull_request", { action: "synchronize", pull_request: { number: 7 } })).toBeNull();
  });

  it("non sveglia nessuno quando la CI passa", () => {
    const r = parseGithubEvent("workflow_run", {
      action: "completed",
      workflow_run: { name: "CI", conclusion: "success", head_branch: "main", html_url: "http://x" },
    });
    expect(r?.level).toBe("SUCCESS");
    expect(r?.wake).toBeUndefined();
  });

  it("allega un wake contestuale quando la CI fallisce su un branch", () => {
    const r = parseGithubEvent("workflow_run", {
      action: "completed",
      workflow_run: { name: "CI", conclusion: "failure", head_branch: "feat/x", html_url: "http://x" },
    });
    expect(r?.level).toBe("ERROR");
    expect(r?.wake).toBeDefined();
    expect(r?.wake?.branch).toBe("feat/x");
    expect(r?.wake?.title).toContain("feat/x");
    expect(r?.wake?.reason).toContain("feat/x");
  });

  it("non sveglia se manca il branch o se la run è in corso", () => {
    expect(parseGithubEvent("workflow_run", { action: "completed", workflow_run: { conclusion: "failure" } })?.wake).toBeUndefined();
    expect(parseGithubEvent("workflow_run", { action: "requested", workflow_run: { conclusion: null } })).toBeNull();
  });

  it("ignora eventi sconosciuti", () => {
    expect(parseGithubEvent("issues", { action: "opened" })).toBeNull();
  });
});
