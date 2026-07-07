import { describe, expect, it } from "vitest";
import { STATUS_META, statusHex } from "./meta";

describe("statusHex", () => {
  it("restituisce il colore di ogni stato noto", () => {
    expect(statusHex("working")).toBe("#38bdf8");
    expect(statusHex("review")).toBe("#fbbf24");
    expect(statusHex("blocked")).toBe("#fb7185");
    expect(statusHex("done")).toBe("#34d399");
    expect(statusHex("awaiting_approval")).toBe("#a78bfa");
    expect(statusHex("idle")).toBe("#94a3b8");
  });

  it("ricade sul grigio idle per stati sconosciuti", () => {
    expect(statusHex("boh")).toBe(STATUS_META.idle.hex);
    expect(statusHex("")).toBe("#94a3b8");
  });

  it("ogni stato del meta ha un hex a 6 cifre", () => {
    for (const meta of Object.values(STATUS_META)) {
      expect(meta.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
