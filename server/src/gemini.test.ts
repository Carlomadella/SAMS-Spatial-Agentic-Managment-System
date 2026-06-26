import { describe, expect, it } from "vitest";
import { usageTokens } from "./gemini";

describe("usageTokens", () => {
  it("reads totalTokenCount from usageMetadata", () => {
    expect(usageTokens({ usageMetadata: { totalTokenCount: 1234 } })).toBe(1234);
  });

  it("returns 0 when usage is missing", () => {
    expect(usageTokens({})).toBe(0);
    expect(usageTokens({ usageMetadata: {} })).toBe(0);
  });
});
