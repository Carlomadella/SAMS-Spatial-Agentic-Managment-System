import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError, jsonFetch } from "./http";

function mockFetch(impl: () => Response | Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

afterEach(() => vi.unstubAllGlobals());

describe("jsonFetch", () => {
  it("parses a JSON body on 2xx", async () => {
    mockFetch(() => new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    await expect(jsonFetch("https://x", {}, "Test")).resolves.toEqual({ ok: 1 });
  });

  it("returns {} for an empty 2xx body (e.g. DELETE)", async () => {
    mockFetch(() => new Response(null, { status: 200 }));
    await expect(jsonFetch("https://x", {}, "Test")).resolves.toEqual({});
  });

  it("throws an HttpError carrying the status on non-2xx", async () => {
    mockFetch(() => new Response("not found", { status: 404 }));
    await expect(jsonFetch("https://x", {}, "GitHub")).rejects.toMatchObject({
      name: "HttpError",
      status: 404,
    });
  });

  it("HttpError message includes the label and status", async () => {
    mockFetch(() => new Response("boom", { status: 500 }));
    const err = await jsonFetch("https://x", {}, "Notion", { retries: 0 }).catch((e) => e as HttpError);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).message).toContain("Notion 500");
  });

  it("throws a clear error on a non-JSON 2xx body", async () => {
    mockFetch(() => new Response("<html>nope</html>", { status: 200 }));
    await expect(jsonFetch("https://x", {}, "Test")).rejects.toThrow(/non-JSON/);
  });

  it("maps an abort/timeout to a readable message", async () => {
    mockFetch(() => {
      const e = new Error("aborted");
      e.name = "TimeoutError";
      return Promise.reject(e);
    });
    await expect(jsonFetch("https://x", {}, "GitHub", { timeoutMs: 1, retries: 0 })).rejects.toThrow(/timeout/);
  });

  it("retries a GET on 5xx then succeeds", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        calls++;
        return calls < 3
          ? new Response("busy", { status: 503, headers: { "retry-after": "0" } })
          : new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );
    await expect(jsonFetch("https://x", {}, "GitHub")).resolves.toEqual({ ok: true });
    expect(calls).toBe(3);
  });

  it("does NOT retry a POST (avoids duplicate writes)", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        calls++;
        return new Response("err", { status: 500 });
      }),
    );
    await expect(jsonFetch("https://x", { method: "POST" }, "GitHub")).rejects.toMatchObject({ status: 500 });
    expect(calls).toBe(1);
  });
});
