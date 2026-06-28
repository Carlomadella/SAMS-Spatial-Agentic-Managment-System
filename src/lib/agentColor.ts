import { AGENT_COLORS, AGENT_HEX, type AgentColor } from "../types";

/** Neutral slate used when an id doesn't map to a known agent color. */
export const NEUTRAL_HEX = "#8a93a6";

/**
 * Recover an agent's hex color from its id (e.g. "agent-blue" → #3b82f6).
 * Falls back to a neutral grey for unknown / runtime-only ids. Used where we
 * only have an agentId (durable history rows) and not the full Agent object.
 */
export function colorFromAgentId(id: string): string {
  const match = /^agent-([a-z]+)$/.exec(id);
  if (match && AGENT_COLORS.includes(match[1] as AgentColor)) {
    return AGENT_HEX[match[1] as AgentColor];
  }
  return NEUTRAL_HEX;
}
