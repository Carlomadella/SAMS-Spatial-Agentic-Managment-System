import { describe, expect, it } from "vitest";
import { agentCapWarning, capState, quotaWarning, usageBadge, type UsageSnapshot } from "./usage";

const snap = (over: Partial<UsageSnapshot> = {}): UsageSnapshot => ({
  day: "2026-11-25",
  provider: "openrouter",
  cap: 50,
  used: 42,
  byProvider: { openrouter: 42 },
  agents: { a: { requests: 20, tokens: 0, avgPerTask: 20, cap: 0 } },
  ...over,
});

describe("usage", () => {
  it("stato del tetto", () => {
    expect(capState(5, 0)).toBe("none");
    expect(capState(7, 10)).toBe("ok");
    expect(capState(8, 10)).toBe("near");
    expect(capState(11, 10)).toBe("reached");
  });

  it("avvisa se la quota rimasta è meno della media dell'agente", () => {
    expect(quotaWarning(snap(), "a")).toBe("Probabilmente non basta: restano 8 richieste, di solito questo agente ne usa 20 per un task.");
    expect(quotaWarning(snap({ used: 10 }), "a")).toBeNull();
    expect(quotaWarning(snap({ used: 50 }), "a")).toMatch(/Quota di oggi finita/);
  });

  it("niente avviso senza tetto del provider o senza media", () => {
    expect(quotaWarning(snap({ cap: null }), "a")).toBeNull();
    expect(quotaWarning(snap(), "nuovo")).toBeNull();
    expect(quotaWarning(null, "a")).toBeNull();
  });

  it("avviso sul tetto dell'agente", () => {
    expect(agentCapWarning({ requests: 8, tokens: 0, avgPerTask: 0, cap: 10 })).toMatch(/Vicino al tetto/);
    expect(agentCapWarning({ requests: 10, tokens: 0, avgPerTask: 0, cap: 10 })).toMatch(/non parte/);
    expect(agentCapWarning({ requests: 1, tokens: 0, avgPerTask: 0, cap: 10 })).toBeNull();
    expect(agentCapWarning(undefined)).toBeNull();
  });

  it("badge della barra in basso", () => {
    expect(usageBadge(snap())).toMatchObject({ text: "42/50 rich.", tone: "warn" });
    expect(usageBadge(snap({ used: 3 }))).toMatchObject({ tone: "ok" });
    expect(usageBadge(snap({ used: 50 }))).toMatchObject({ tone: "bad" });
    expect(usageBadge(snap({ cap: null, used: 7 }))).toMatchObject({ text: "7 rich.", tone: "ok" });
  });
});
