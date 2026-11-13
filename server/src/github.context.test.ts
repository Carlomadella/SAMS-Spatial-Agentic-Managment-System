import { describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({
  getSettings: () => ({ githubRepo: "server/repo", githubToken: "server-token", baseBranch: "main", provider: "openrouter" }),
}));

const { effectiveSettings, githubContext, runWithGithub, runWithRepo } = await import("./github");

describe("contesto GitHub per-task", () => {
  it("fuori da un contesto valgono le impostazioni del server", () => {
    expect(githubContext()).toEqual({ repo: "server/repo", token: "server-token", baseBranch: "main" });
  });

  it("dentro il contesto dell'utente valgono repo, token e branch dell'utente", async () => {
    const seen = await runWithGithub({ repo: "mario/app", token: "user-token", baseBranch: "dev" }, async () => {
      await Promise.resolve();
      return effectiveSettings();
    });
    expect(seen.githubRepo).toBe("mario/app");
    expect(seen.githubToken).toBe("user-token");
    expect(seen.baseBranch).toBe("dev");
    expect(seen.provider).toBe("openrouter");
  });

  it("il meta-agente cambia solo la repo e tiene il token dell'utente", () => {
    const seen = runWithGithub({ repo: "mario/app", token: "user-token", baseBranch: "dev" }, () =>
      runWithRepo("mario/altra", githubContext),
    );
    expect(seen).toEqual({ repo: "mario/altra", token: "user-token", baseBranch: "dev" });
  });

  it("due task in parallelo non si mescolano", async () => {
    const run = (repo: string) =>
      runWithGithub({ repo, token: `t-${repo}` }, async () => {
        await new Promise((r) => setTimeout(r, 5));
        return githubContext();
      });
    const [a, b] = await Promise.all([run("a/a"), run("b/b")]);
    expect(a.token).toBe("t-a/a");
    expect(b.token).toBe("t-b/b");
  });
});
