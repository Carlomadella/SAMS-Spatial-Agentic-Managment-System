import { describe, expect, it } from "vitest";
import { cn, uid, clock, clamp, titleCase } from "./utils";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values and resolves conditionals", () => {
    const off = false;
    expect(cn("a", off && "b", null, undefined, "c")).toBe("a c");
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });
});

describe("uid", () => {
  it("uses the given prefix and defaults to 'id'", () => {
    expect(uid("agent").startsWith("agent-")).toBe(true);
    expect(uid().startsWith("id-")).toBe(true);
  });

  it("never collides across rapid successive calls", () => {
    const ids = Array.from({ length: 1000 }, () => uid());
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("clock", () => {
  it("formats an epoch timestamp as 24h HH:MM:SS", () => {
    // 1970-01-01T00:00:00Z rendered in en-GB, 24h.
    expect(clock(0)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

describe("clamp", () => {
  it("returns the value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to the bounds", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it("returns the bound at the edges", () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe("titleCase", () => {
  it("capitalises the first character only", () => {
    expect(titleCase("review")).toBe("Review");
    expect(titleCase("hello world")).toBe("Hello world");
  });

  it("leaves an already-capitalised or empty string sensible", () => {
    expect(titleCase("Done")).toBe("Done");
    expect(titleCase("")).toBe("");
  });
});
