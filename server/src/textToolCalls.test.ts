import { describe, expect, it } from "vitest";
import { parseTextToolCalls, stripTextToolCalls } from "./textToolCalls";

// Simulazione 24/11: Nemotron :free ha chiamato `done` scrivendolo nel testo invece che
// come chiamata strutturata; SAMS non l'ha riconosciuto e il riassunto era XML grezzo.
const NEMOTRON = `<tool_call>
<function=done>
<parameter=summary>
## Revisione PR #3
Il progetto **non si può installare**.
</parameter>
</function>
</tool_call>`;

describe("parseTextToolCalls", () => {
  it("riconosce il formato <function=…><parameter=…> (Nemotron/Qwen)", () => {
    expect(parseTextToolCalls(NEMOTRON)).toEqual([
      { name: "done", args: { summary: "## Revisione PR #3\nIl progetto **non si può installare**." } },
    ]);
  });

  it("più parametri e più chiamate; un numero resta numero", () => {
    const text = `Leggo due file.
<tool_call><function=gh_read_file><parameter=path>a.ts</parameter><parameter=offset>800</parameter></function></tool_call>
<tool_call><function=gh_list_files><parameter=path>src</parameter></function></tool_call>`;
    expect(parseTextToolCalls(text)).toEqual([
      { name: "gh_read_file", args: { path: "a.ts", offset: 800 } },
      { name: "gh_list_files", args: { path: "src" } },
    ]);
  });

  it("riconosce il formato JSON dentro <tool_call>", () => {
    const text = `<tool_call>{"name": "done", "arguments": {"summary": "fatto"}}</tool_call>`;
    expect(parseTextToolCalls(text)).toEqual([{ name: "done", args: { summary: "fatto" } }]);
  });

  it("un array JSON come valore di parametro diventa array", () => {
    const text = `<tool_call><function=gh_read_files><parameter=paths>["a.ts","b.ts"]</parameter></function></tool_call>`;
    expect(parseTextToolCalls(text)).toEqual([{ name: "gh_read_files", args: { paths: ["a.ts", "b.ts"] } }]);
  });

  it("testo normale o markup rotto → nessuna chiamata", () => {
    expect(parseTextToolCalls("Ho finito la revisione.")).toEqual([]);
    expect(parseTextToolCalls("<tool_call>{non json}</tool_call>")).toEqual([]);
    expect(parseTextToolCalls("")).toEqual([]);
  });
});

describe("stripTextToolCalls", () => {
  it("toglie i blocchi <tool_call> e lascia il resto", () => {
    expect(stripTextToolCalls(`Prima.\n${NEMOTRON}\nDopo.`)).toBe("Prima.\n\nDopo.");
  });
});
