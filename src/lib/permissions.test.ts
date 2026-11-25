import { beforeEach, describe, expect, it } from "vitest";
import { changeNote, notePermissionEvent, usePermissionRequests } from "./permissions";

beforeEach(() => usePermissionRequests.setState({ pending: {} }));

describe("permessi — richieste dallo stream", () => {
  it("una richiesta compare e sparisce quando si chiude", () => {
    notePermissionEvent({ agentId: "a", agentName: "Blue", permissionRequest: { group: "read", groupLabel: "Leggere", tool: "gh_read_file", detail: "gh_read_file: x", since: 1 } });
    expect(usePermissionRequests.getState().pending.a).toMatchObject({ agentName: "Blue", group: "read" });
    notePermissionEvent({ agentId: "a", permissionRequest: null });
    expect(usePermissionRequests.getState().pending.a).toBeUndefined();
  });

  it("gli eventi senza il campo non toccano nulla", () => {
    notePermissionEvent({ agentId: "a", agentName: "Blue", permissionRequest: { group: "web", groupLabel: "Web", tool: "web_fetch", detail: "", since: 1 } });
    notePermissionEvent({ agentId: "a" });
    expect(usePermissionRequests.getState().pending.a?.group).toBe("web");
  });

  it("dice chi ha cambiato un gruppo", () => {
    expect(changeNote(undefined)).toMatch(/default/);
    expect(changeNote({ group: "read", mode: "allow", updatedBy: "Carlo (owner)", updatedAt: 0 })).toMatch(/^Consentito — scelto da Carlo \(owner\)/);
  });
});
