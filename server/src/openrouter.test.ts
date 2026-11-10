import { describe, expect, it } from "vitest";
import { openrouterHeaders, openrouterModel } from "./openrouter";

describe("openrouterModel", () => {
  it("falls back to a default :free model when the stored model is not an OpenRouter id", () => {
    // The default env model (e.g. a Gemini id, no "/") must not leak through.
    const m = openrouterModel();
    expect(m).toContain("/");
    expect(m).toMatch(/:free$/);
  });

  it("returns a non-empty string", () => {
    expect(openrouterModel().length).toBeGreaterThan(0);
  });
});

describe("openrouterHeaders", () => {
  it("are accepted by fetch: every value is a valid ByteString (no em dash, no accents)", () => {
    // Il bug del 2026-11-10: `X-Title` conteneva "—" e fetch rifiutava la richiesta
    // prima di spedirla (TypeError: Cannot convert argument to a ByteString).
    // `new Headers` applica la stessa validazione di fetch.
    const h = openrouterHeaders("sk-or-test");
    expect(() => new Headers(h)).not.toThrow();
    for (const v of Object.values(h)) expect(v).toMatch(/^[\x20-\x7e]*$/);
  });

  it("carries the key and the app attribution", () => {
    const h = new Headers(openrouterHeaders("sk-or-test"));
    expect(h.get("authorization")).toBe("Bearer sk-or-test");
    expect(h.get("content-type")).toBe("application/json");
    expect(h.get("x-title")).toContain("SAMS");
    expect(h.get("http-referer")).toMatch(/^https:\/\//);
  });
});
