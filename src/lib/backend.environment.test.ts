import { afterEach, describe, expect, it, vi } from "vitest";
import { applyRuntimeStatus, assignRemote, type RuntimeStatus } from "./backend";
import { useStore } from "../store/useStore";

function sentBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe("ambiente del task", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useStore.getState().setEnvironment("staging");
  });

  it("assignRemote manda l'ambiente scelto in UI", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", f);
    useStore.getState().setEnvironment("prod");
    await assignRemote("a1", "Ada", "titolo");
    expect(sentBody(f).environment).toBe("prod");
  });

  it("un task in coda tiene l'ambiente in cui è stato accodato", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", f);
    useStore.getState().setEnvironment("prod");
    await assignRemote("a1", "Ada", "titolo", undefined, undefined, undefined, undefined, "dev");
    expect(sentBody(f).environment).toBe("dev");
  });

  it("lo stato del runtime porta nello store i branch degli ambienti", () => {
    applyRuntimeStatus({ ready: true, envBranches: { dev: "develop", staging: "", prod: "main" } } as unknown as RuntimeStatus);
    expect(useStore.getState().envBranches).toEqual({ dev: "develop", staging: "", prod: "main" });
    applyRuntimeStatus(null);
    expect(useStore.getState().envBranches).toEqual({ dev: "", staging: "", prod: "" });
  });
});
