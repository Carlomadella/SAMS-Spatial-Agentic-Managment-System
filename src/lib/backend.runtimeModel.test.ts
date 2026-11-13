import { beforeEach, describe, expect, it } from "vitest";
import { applyRuntimeStatus, type RuntimeStatus } from "./backend";
import { useStore } from "../store/useStore";

const status = (over: Partial<RuntimeStatus>): RuntimeStatus => ({ ready: true, model: "gemini-2.5-flash", ...over }) as RuntimeStatus;

describe("applyRuntimeStatus — il modello effettivo arriva nello store", () => {
  beforeEach(() => useStore.setState({ runtimeReady: false, runtimeModel: "" }));

  it("usa activeModel (quello vero), non il campo grezzo model", () => {
    applyRuntimeStatus(status({ provider: "openrouter", activeModel: "nvidia/nemotron-3-ultra-550b-a55b:free" }));
    expect(useStore.getState().runtimeModel).toBe("nvidia/nemotron-3-ultra-550b-a55b:free");
    expect(useStore.getState().runtimeReady).toBe(true);
  });

  it("runtime irraggiungibile o vecchio server senza activeModel → stringa vuota (la UI ripiega sull'etichetta)", () => {
    useStore.setState({ runtimeModel: "x" });
    applyRuntimeStatus(null);
    expect(useStore.getState().runtimeModel).toBe("");
    applyRuntimeStatus(status({}));
    expect(useStore.getState().runtimeModel).toBe("");
  });
});
