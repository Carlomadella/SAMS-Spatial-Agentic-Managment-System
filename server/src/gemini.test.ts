import { describe, expect, it } from "vitest";
import type { GenerateContentResponse } from "@google/genai";
import { collectStream, usageTokens } from "./gemini";

describe("usageTokens", () => {
  it("reads totalTokenCount from usageMetadata", () => {
    expect(usageTokens({ usageMetadata: { totalTokenCount: 1234 } })).toBe(1234);
  });

  it("returns 0 when usage is missing", () => {
    expect(usageTokens({})).toBe(0);
    expect(usageTokens({ usageMetadata: {} })).toBe(0);
  });
});

// Fake async generator — lets us test collectStream without a live Gemini client
async function* fakeStream(chunks: Partial<GenerateContentResponse>[]): AsyncGenerator<GenerateContentResponse> {
  for (const c of chunks) yield c as GenerateContentResponse;
}

describe("collectStream", () => {
  it("accumulates text across chunks and calls onText for each", async () => {
    const received: string[] = [];
    const result = await collectStream(
      fakeStream([{ text: "Ciao" }, { text: " mondo" }]),
      (t) => received.push(t),
    );
    expect(result.text).toBe("Ciao mondo");
    expect(received).toEqual(["Ciao", " mondo"]);
    expect(result.functionCalls).toHaveLength(0);
  });

  it("collects function calls from the chunk that carries them", async () => {
    const fc = { name: "gh_read_file", args: { path: "foo.ts" } };
    const result = await collectStream(
      fakeStream([{ text: "Leggo il file:" }, { functionCalls: [fc] }]),
      () => {},
    );
    expect(result.functionCalls).toHaveLength(1);
    expect(result.functionCalls[0].name).toBe("gh_read_file");
    expect(result.text).toBe("Leggo il file:");
  });

  it("takes the highest token count from the last usageMetadata chunk", async () => {
    const result = await collectStream(
      fakeStream([
        { text: "a", usageMetadata: { totalTokenCount: 5 } },
        { text: "b", usageMetadata: { totalTokenCount: 18 } },
      ]),
      () => {},
    );
    expect(result.tokens).toBe(18);
  });

  it("handles an empty stream gracefully", async () => {
    const result = await collectStream(fakeStream([]), () => {});
    expect(result.text).toBe("");
    expect(result.functionCalls).toHaveLength(0);
    expect(result.tokens).toBe(0);
  });

  it("collects function calls from multiple chunks", async () => {
    const call1 = { name: "gh_list_files", args: { path: "/" } };
    const call2 = { name: "notion_read", args: { page_title: "Home" } };
    const result = await collectStream(
      fakeStream([{ functionCalls: [call1] }, { functionCalls: [call2] }]),
      () => {},
    );
    expect(result.functionCalls).toHaveLength(2);
    expect(result.functionCalls.map((c) => c.name)).toEqual(["gh_list_files", "notion_read"]);
  });
});
