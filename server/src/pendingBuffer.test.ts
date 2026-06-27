import { describe, expect, it } from "vitest";
import { clearPending, getPending, setPending } from "./pendingBuffer";

const work = { branch: "b", title: "t", agentName: "a", files: [] };

describe("pendingBuffer", () => {
  it("stores and retrieves staged work by agent id", () => {
    setPending("agent-1", work);
    expect(getPending("agent-1")).toMatchObject({ branch: "b", title: "t" });
    expect(getPending("agent-1")?.createdAt).toBeTypeOf("number");
  });

  it("clearPending removes the entry", () => {
    setPending("agent-2", work);
    clearPending("agent-2");
    expect(getPending("agent-2")).toBeUndefined();
  });

  it("a newer setPending overwrites the previous staged set", () => {
    setPending("agent-3", { ...work, title: "first" });
    setPending("agent-3", { ...work, title: "second" });
    expect(getPending("agent-3")?.title).toBe("second");
  });

  it("caps the number of stored entries", () => {
    for (let i = 0; i < 60; i++) setPending(`bulk-${i}`, work);
    let alive = 0;
    for (let i = 0; i < 60; i++) if (getPending(`bulk-${i}`)) alive++;
    expect(alive).toBeLessThanOrEqual(50);
  });
});
