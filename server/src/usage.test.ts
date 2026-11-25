import { describe, expect, it } from "vitest";
import { openDb } from "./db";
import {
  agentCapState,
  agentRequestsToday,
  capBlockMessage,
  getAgentCap,
  providerDailyCap,
  recordRequest,
  recordTaskEnd,
  sanitizeCap,
  setAgentCap,
  usageDay,
  usageReport,
} from "./usage";

const T = Date.UTC(2026, 10, 25, 12, 0, 0);
const DAY = 86_400_000;

describe("usage — regole", () => {
  it("il giorno è quello UTC (la quota OpenRouter si azzera a mezzanotte UTC)", () => {
    expect(usageDay(Date.UTC(2026, 10, 25, 23, 30))).toBe("2026-11-25");
    expect(usageDay(Date.UTC(2026, 10, 26, 0, 10))).toBe("2026-11-26");
  });

  it("tetto ricavato dal provider: 50 per i modelli :free di OpenRouter, altrimenti nessuno", () => {
    expect(providerDailyCap("openrouter", "nvidia/nemotron:free")).toBe(50);
    expect(providerDailyCap("openrouter", "openai/gpt-4o")).toBeNull();
    expect(providerDailyCap("gemini", "gemini-2.5-flash")).toBeNull();
  });

  it("stato del tetto dell'agente: avviso all'80%, poi raggiunto", () => {
    expect(agentCapState(10, 0)).toBe("none");
    expect(agentCapState(7, 10)).toBe("ok");
    expect(agentCapState(8, 10)).toBe("near");
    expect(agentCapState(10, 10)).toBe("reached");
  });

  it("tetto valido o 0", () => {
    expect(sanitizeCap("20")).toBe(20);
    expect(sanitizeCap(-3)).toBe(0);
    expect(sanitizeCap("x")).toBe(0);
    expect(sanitizeCap(1e9)).toBe(100_000);
  });

  it("blocca solo a tetto raggiunto", () => {
    expect(capBlockMessage("Blue", 9, 10)).toBeNull();
    expect(capBlockMessage("Blue", 3, 0)).toBeNull();
    expect(capBlockMessage("Blue", 10, 10)).toMatch(/Blue ha raggiunto il suo tetto di oggi \(10\/10/);
  });
});

describe("usage — database", () => {
  it("conta richieste e token per agente e provider, solo di oggi", async () => {
    const db = await openDb(":memory:");
    await recordRequest(db, "a", "openrouter", 100, T);
    await recordRequest(db, "a", "openrouter", 50, T);
    await recordRequest(db, "a", "gemini", 10, T);
    await recordRequest(db, "b", "openrouter", 5, T);
    await recordRequest(db, "a", "openrouter", 999, T - DAY); // ieri: non conta oggi
    const r = await usageReport(db, T);
    expect(r.day).toBe("2026-11-25");
    expect(r.byProvider).toEqual({ openrouter: 3, gemini: 1 });
    expect(r.agents.a).toMatchObject({ requests: 3, tokens: 160 });
    expect(r.agents.b).toMatchObject({ requests: 1, tokens: 5 });
    expect(await agentRequestsToday(db, "a", T)).toBe(3);
    expect(await agentRequestsToday(db, "zzz", T)).toBe(0);
  });

  it("media di richieste per task sugli ultimi 7 giorni", async () => {
    const db = await openDb(":memory:");
    for (let i = 0; i < 20; i++) await recordRequest(db, "a", "openrouter", 1, T - DAY);
    await recordTaskEnd(db, "a", T - DAY);
    for (let i = 0; i < 10; i++) await recordRequest(db, "a", "openrouter", 1, T);
    await recordTaskEnd(db, "a", T);
    for (let i = 0; i < 100; i++) await recordRequest(db, "a", "openrouter", 1, T - 10 * DAY); // troppo vecchio
    await recordTaskEnd(db, "a", T - 10 * DAY);
    const r = await usageReport(db, T);
    expect(r.agents.a.avgPerTask).toBe(15);
  });

  it("tetto per agente: si imposta, si toglie con 0 e compare nel resoconto", async () => {
    const db = await openDb(":memory:");
    await setAgentCap(db, "a", 30, "Carlo (owner)", T);
    expect(await getAgentCap(db, "a")).toBe(30);
    expect((await usageReport(db, T)).agents.a.cap).toBe(30);
    await setAgentCap(db, "a", 0, "Carlo (owner)", T);
    expect(await getAgentCap(db, "a")).toBe(0);
    const by = await db.get<{ by: string }>(`SELECT updated_by AS by FROM agent_limits WHERE agent_id = 'a'`);
    expect(by?.by).toBe("Carlo (owner)");
  });
});
