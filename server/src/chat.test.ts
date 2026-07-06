import { describe, expect, it } from "vitest";
import { sanitizeChatInput } from "./chat";

describe("sanitizeChatInput", () => {
  it("ripulisce autore e testo (trim)", () => {
    expect(sanitizeChatInput({ author: "  Ada  ", text: "  ciao  " })).toEqual({
      author: "Ada",
      text: "ciao",
    });
  });

  it("usa 'Ospite' quando l'autore manca o è vuoto", () => {
    expect(sanitizeChatInput({ text: "hey" })).toEqual({ author: "Ospite", text: "hey" });
    expect(sanitizeChatInput({ author: "   ", text: "hey" })).toEqual({ author: "Ospite", text: "hey" });
  });

  it("scarta un messaggio senza testo", () => {
    expect(sanitizeChatInput({ author: "Ada", text: "   " })).toBeNull();
    expect(sanitizeChatInput({ author: "Ada" })).toBeNull();
    expect(sanitizeChatInput(null)).toBeNull();
    expect(sanitizeChatInput("nope")).toBeNull();
  });

  it("taglia autore e testo troppo lunghi", () => {
    const res = sanitizeChatInput({ author: "a".repeat(100), text: "b".repeat(1000) });
    expect(res?.author.length).toBe(40);
    expect(res?.text.length).toBe(500);
  });
});
