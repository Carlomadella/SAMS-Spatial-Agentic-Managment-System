import { describe, expect, it } from "vitest";
import { getArrangement, OFFICE_ARRANGEMENTS, DEFAULT_OFFICE_ARRANGEMENT } from "./officeLayout";

describe("officeLayout", () => {
  it("il default è la prima disposizione (Classico, offset nullo)", () => {
    expect(DEFAULT_OFFICE_ARRANGEMENT).toBe("classic");
    expect(getArrangement("classic").loungeOffset).toEqual([0, 0, 0]);
    expect(getArrangement("classic").loungeSpin).toBe(0);
  });
  it("getArrangement risolve per id", () => {
    expect(getArrangement("cozy").label).toBe("Raccolto");
  });
  it("id sconosciuto → fallback alla prima", () => {
    expect(getArrangement("bogus")).toBe(OFFICE_ARRANGEMENTS[0]);
  });
  it("ogni disposizione ha id, label ed emoji non vuoti", () => {
    for (const a of OFFICE_ARRANGEMENTS) {
      expect(a.id).toBeTruthy();
      expect(a.label).toBeTruthy();
      expect(a.emoji).toBeTruthy();
      expect(a.loungeOffset).toHaveLength(3);
    }
  });
});
