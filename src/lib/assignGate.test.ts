import { describe, expect, it } from "vitest";
import { assignBlock } from "./assignGate";
import type { GithubAccountStatus } from "./backend";

const acc = (over: Partial<GithubAccountStatus> = {}): GithubAccountStatus => ({
  enabled: true,
  signedIn: true,
  connected: true,
  login: "mario",
  repo: "mario/app",
  baseBranch: "main",
  ...over,
});

describe("assignBlock", () => {
  it("non blocca senza runtime (mondo locale)", () => {
    expect(assignBlock({ online: false, toolsReady: false, account: null, owner: true })).toBeNull();
  });

  it("non blocca se gli strumenti del server sono pronti e non c'è il GitHub per utente", () => {
    expect(assignBlock({ online: true, toolsReady: true, account: acc({ enabled: false, connected: false }), owner: false })).toBeNull();
  });

  it("non blocca finché lo stato non è noto", () => {
    expect(assignBlock({ online: true, toolsReady: null, account: null, owner: true })).toBeNull();
  });

  it("con il GitHub per utente chiede di collegarlo, e porta a «Il tuo GitHub»", () => {
    const b = assignBlock({ online: true, toolsReady: true, account: acc({ connected: false, repo: "" }), owner: false });
    expect(b?.section).toBe("github");
    expect(b?.message).toMatch(/collega/i);
  });

  it("con GitHub collegato ma senza repo chiede di sceglierla", () => {
    const b = assignBlock({ online: true, toolsReady: false, account: acc({ repo: "" }), owner: false });
    expect(b?.section).toBe("github");
    expect(b?.message).toMatch(/repo/i);
  });

  it("con GitHub dell'utente pronto non blocca anche se il server non ha strumenti", () => {
    expect(assignBlock({ online: true, toolsReady: false, account: acc(), owner: false })).toBeNull();
  });

  it("chi non ha fatto l'accesso segue le regole del server", () => {
    expect(assignBlock({ online: true, toolsReady: true, account: acc({ signedIn: false, connected: false }), owner: false })).toBeNull();
  });

  it("senza strumenti sul server: l'owner va al GitHub del server", () => {
    const b = assignBlock({ online: true, toolsReady: false, account: acc({ enabled: false, connected: false }), owner: true });
    expect(b?.section).toBe("repository");
  });

  it("senza strumenti sul server: chi non è owner viene avvisato senza link", () => {
    const b = assignBlock({ online: true, toolsReady: false, account: null, owner: false });
    expect(b?.section).toBeNull();
    expect(b?.message).toMatch(/proprietario/i);
  });
});

describe("currentAssignBlock — lo stesso blocco fuori da React", () => {
  it("legge lo store: senza strumenti blocca, con strumenti no", async () => {
    const { currentAssignBlock } = await import("./assignGate");
    const { useStore } = await import("../store/useStore");
    useStore.setState({ backendOnline: true, toolsReady: false, githubAccount: null, viewerRole: "owner" });
    expect(currentAssignBlock()?.section).toBe("repository");
    useStore.setState({ toolsReady: true });
    expect(currentAssignBlock()).toBeNull();
    useStore.setState({ backendOnline: false, toolsReady: null });
  });
});
