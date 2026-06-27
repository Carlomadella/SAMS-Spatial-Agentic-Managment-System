import { describe, expect, it } from "vitest";
import type { Settings } from "./config";
import { buildToolSpecs, makeBranch, slugify, str, toGeminiDecls, toGroqTools, truncate } from "./agentTools";

const baseSettings = { baseBranch: "main" } as Settings;

describe("string helpers", () => {
  it("slugify lowercases, strips punctuation and caps length", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
    expect(slugify("   ")).toBe("task"); // empty → fallback
    expect(slugify("a".repeat(60)).length).toBeLessThanOrEqual(40);
  });

  it("makeBranch produces a sams/<agent>/<slug>-<ts> branch", () => {
    const b = makeBranch("Red Agent", "Fix the bug");
    expect(b).toMatch(/^sams\/red-agent\/fix-the-bug-[a-z0-9]+$/);
  });

  it("truncate adds an ellipsis only when over the limit", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hello world", 5)).toBe("hell…");
  });

  it("str coerces non-strings safely", () => {
    expect(str("x")).toBe("x");
    expect(str(undefined)).toBe("");
    expect(str(null)).toBe("");
    expect(str(42)).toBe("42");
    expect(str({ a: 1 })).toBe('{"a":1}');
  });
});

describe("buildToolSpecs gating", () => {
  it("includes gh_* tools only when repo is enabled", () => {
    const names = buildToolSpecs(baseSettings, { repoEnabled: true, notionEnabled: false }).map((t) => t.name);
    expect(names).toContain("gh_read_file");
    expect(names).toContain("gh_write_file");
    expect(names).not.toContain("notion_write");
  });

  it("includes notion_* tools only when notion is enabled", () => {
    const names = buildToolSpecs(baseSettings, { repoEnabled: false, notionEnabled: true }).map((t) => t.name);
    expect(names).toContain("notion_write");
    expect(names).toContain("notion_create_page");
    expect(names).not.toContain("gh_read_file");
  });

  it("always includes the universal tools (plan/web/relay/done)", () => {
    const names = buildToolSpecs(baseSettings, { repoEnabled: false, notionEnabled: false }).map((t) => t.name);
    expect(names).toEqual(["announce_plan", "web_fetch", "relay_task", "done"]);
  });

  it("interpolates the base branch into gh tool descriptions", () => {
    const specs = buildToolSpecs({ baseBranch: "develop" } as Settings, { repoEnabled: true, notionEnabled: false });
    const read = specs.find((t) => t.name === "gh_read_file");
    expect(read?.description).toContain("develop");
  });
});

describe("provider adapters keep the spec set in sync", () => {
  const specs = buildToolSpecs(baseSettings, { repoEnabled: true, notionEnabled: true });

  it("toGeminiDecls maps schema → parametersJsonSchema for every spec", () => {
    const decls = toGeminiDecls(specs);
    expect(decls).toHaveLength(specs.length);
    expect(decls.every((d) => "parametersJsonSchema" in d)).toBe(true);
    expect(decls.map((d) => d.name)).toEqual(specs.map((s) => s.name));
  });

  it("toGroqTools wraps each spec in a function envelope", () => {
    const tools = toGroqTools(specs);
    expect(tools).toHaveLength(specs.length);
    expect(tools.every((t) => t.type === "function" && "parameters" in t.function)).toBe(true);
    expect(tools.map((t) => t.function.name)).toEqual(specs.map((s) => s.name));
  });
});
