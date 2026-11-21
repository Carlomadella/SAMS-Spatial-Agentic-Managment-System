import { describe, expect, it } from "vitest";
import { reviewBranchName, reviewTaskText } from "./reviewDesk";
import { clearPending, listPending, setPending } from "./pendingBuffer";

describe("Reparto revisioni — pezzi puri", () => {
  it("il branch di revisione è valido e non è mai il principale", () => {
    const b = reviewBranchName("Sim-Dev ✨", 0);
    expect(b).toBe("sams/revisione/sim-dev-0");
    expect(reviewBranchName("!!!", 35)).toBe("sams/revisione/agente-z");
  });

  it("il task con le note dice dove lavorare e come tornare in revisione", () => {
    const t = reviewTaskText("rinomina la funzione", "feat/x", 4);
    expect(t).toContain("«rinomina la funzione»");
    expect(t).toContain("feat/x (PR #4)");
    expect(t).toContain("gh_merge_pr pr_number=4");
    expect(reviewTaskText("ok", "feat/y")).not.toContain("gh_merge_pr");
  });

  it("listPending elenca le richieste dalla più vecchia", () => {
    setPending("r1", { branch: "b", title: "uno", agentName: "A", files: [] });
    setPending("r2", { branch: "main", title: "due", agentName: "B", files: [], toMain: true });
    const ids = listPending().map((w) => w.agentId).filter((id) => id === "r1" || id === "r2");
    expect(ids).toEqual(["r1", "r2"]);
    clearPending("r1");
    clearPending("r2");
  });
});
