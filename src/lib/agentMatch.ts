import type { Agent } from "../types";

/**
 * Resolve an agent from a free-text token typed by a user (e.g. in the Terminal):
 * tries exact name, then color, then name-prefix, then name-substring — in that
 * order of confidence. A blank token matches nobody. This is distinct from the
 * relay matcher (`findRelayTarget`), which resolves by *role*.
 */
export function resolveAgentByToken(agents: Agent[], token: string): Agent | undefined {
  const q = token.trim().toLowerCase();
  if (!q) return undefined;
  return (
    agents.find((a) => a.name.toLowerCase() === q) ??
    agents.find((a) => a.color === q) ??
    agents.find((a) => a.name.toLowerCase().startsWith(q)) ??
    agents.find((a) => a.name.toLowerCase().includes(q))
  );
}
