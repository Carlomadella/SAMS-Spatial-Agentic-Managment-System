import { describe, expect, it } from "vitest";
import { buildDatabaseProps, type DatabaseSchema } from "./notion";

const schema: DatabaseSchema = {
  Nome: { type: "title" },
  Note: { type: "rich_text" },
  Priorità: { type: "number" },
  Stato: { type: "select" },
  Tag: { type: "multi_select" },
  Link: { type: "url" },
  Fatto: { type: "checkbox" },
  Scadenza: { type: "date" },
  Persona: { type: "people" }, // unsupported type
};

describe("buildDatabaseProps", () => {
  it("maps each supported type from the schema", () => {
    const props = buildDatabaseProps(schema, {
      Nome: "Task X",
      Note: "una nota",
      Priorità: "3",
      Stato: "In corso",
      Link: "https://example.com",
      Scadenza: "2026-06-29",
    });
    expect(props.Nome).toEqual({ title: [{ type: "text", text: { content: "Task X" } }] });
    expect(props.Note).toEqual({ rich_text: [{ type: "text", text: { content: "una nota" } }] });
    expect(props.Priorità).toEqual({ number: 3 });
    expect(props.Stato).toEqual({ select: { name: "In corso" } });
    expect(props.Link).toEqual({ url: "https://example.com" });
    expect(props.Scadenza).toEqual({ date: { start: "2026-06-29" } });
  });

  it("splits and trims multi_select values, dropping empties", () => {
    const props = buildDatabaseProps(schema, { Tag: "a, b ,,  c " });
    expect(props.Tag).toEqual({ multi_select: [{ name: "a" }, { name: "b" }, { name: "c" }] });
  });

  it("parses checkbox truthy tokens (incl. it/en) and treats the rest as false", () => {
    expect(buildDatabaseProps(schema, { Fatto: "sì" }).Fatto).toEqual({ checkbox: true });
    expect(buildDatabaseProps(schema, { Fatto: "yes" }).Fatto).toEqual({ checkbox: true });
    expect(buildDatabaseProps(schema, { Fatto: "1" }).Fatto).toEqual({ checkbox: true });
    expect(buildDatabaseProps(schema, { Fatto: "X" }).Fatto).toEqual({ checkbox: true });
    expect(buildDatabaseProps(schema, { Fatto: "no" }).Fatto).toEqual({ checkbox: false });
  });

  it("skips properties not present in the schema (typo never aborts the write)", () => {
    const props = buildDatabaseProps(schema, { Inesistente: "x", Nome: "ok" });
    expect(props).not.toHaveProperty("Inesistente");
    expect(props.Nome).toBeDefined();
  });

  it("omits a number field that isn't numeric instead of sending NaN", () => {
    const props = buildDatabaseProps(schema, { Priorità: "alta" });
    expect(props).not.toHaveProperty("Priorità");
  });

  it("skips unsupported property types", () => {
    const props = buildDatabaseProps(schema, { Persona: "Mario" });
    expect(props).not.toHaveProperty("Persona");
  });

  it("truncates title and rich_text to 2000 chars", () => {
    const long = "a".repeat(3000);
    const props = buildDatabaseProps(schema, { Nome: long, Note: long }) as {
      Nome: { title: Array<{ text: { content: string } }> };
      Note: { rich_text: Array<{ text: { content: string } }> };
    };
    expect(props.Nome.title[0].text.content).toHaveLength(2000);
    expect(props.Note.rich_text[0].text.content).toHaveLength(2000);
  });
});
