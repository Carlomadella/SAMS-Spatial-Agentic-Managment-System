import { describe, expect, it } from "vitest";
import { sanitizeSelection } from "./selections";

describe("sanitizeSelection", () => {
  it("accepts a selection of an agent", () => {
    expect(sanitizeSelection({ id: "v1", name: "Marco", agentId: "agent-7" })).toEqual({
      id: "v1",
      name: "Marco",
      agentId: "agent-7",
    });
  });

  it("treats a missing/blank agentId as no selection (null)", () => {
    expect(sanitizeSelection({ id: "v1", name: "Marco" })).toEqual({ id: "v1", name: "Marco", agentId: null });
    expect(sanitizeSelection({ id: "v1", agentId: "  " })).toEqual({ id: "v1", name: "Ospite", agentId: null });
  });

  it("rejects a missing or blank id", () => {
    expect(sanitizeSelection({ agentId: "a" })).toBeNull();
    expect(sanitizeSelection({ id: "   ", agentId: "a" })).toBeNull();
  });

  it("rejects non-object bodies", () => {
    expect(sanitizeSelection(null)).toBeNull();
    expect(sanitizeSelection("x")).toBeNull();
  });

  it("defaults a blank name and caps long id/name/agentId", () => {
    const s = sanitizeSelection({ id: "a".repeat(200), name: "b".repeat(200), agentId: "c".repeat(200) })!;
    expect(s.id).toHaveLength(64);
    expect(s.name).toHaveLength(40);
    expect(s.agentId).toHaveLength(64);
  });
});
