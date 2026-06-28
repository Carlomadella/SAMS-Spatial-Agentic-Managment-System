import { describe, expect, it } from "vitest";
import { colorFromAgentId, NEUTRAL_HEX } from "./agentColor";
import { AGENT_HEX } from "../types";

describe("colorFromAgentId", () => {
  it("maps a known agent id to its palette hex", () => {
    expect(colorFromAgentId("agent-blue")).toBe(AGENT_HEX.blue);
    expect(colorFromAgentId("agent-green")).toBe(AGENT_HEX.green);
    expect(colorFromAgentId("agent-red")).toBe(AGENT_HEX.red);
  });

  it("falls back to neutral for an unknown color name", () => {
    expect(colorFromAgentId("agent-teal")).toBe(NEUTRAL_HEX);
  });

  it("falls back to neutral for runtime / malformed ids", () => {
    expect(colorFromAgentId("runtime")).toBe(NEUTRAL_HEX);
    expect(colorFromAgentId("agent-Blue")).toBe(NEUTRAL_HEX); // case-sensitive by design
    expect(colorFromAgentId("agent-blue-2")).toBe(NEUTRAL_HEX);
    expect(colorFromAgentId("")).toBe(NEUTRAL_HEX);
  });
});
