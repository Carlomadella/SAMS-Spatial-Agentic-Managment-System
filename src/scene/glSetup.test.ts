import { describe, expect, it } from "vitest";
import type { WebGLRenderer } from "three";
import { configureRenderer } from "./glSetup";

const fakeGl = () => ({ debug: { checkShaderErrors: true } }) as unknown as WebGLRenderer;

describe("configureRenderer", () => {
  it("spegne il controllo degli shader in produzione", () => {
    const gl = fakeGl();
    configureRenderer(gl, false);
    expect(gl.debug.checkShaderErrors).toBe(false);
  });
  it("lo lascia acceso in sviluppo", () => {
    const gl = fakeGl();
    configureRenderer(gl, true);
    expect(gl.debug.checkShaderErrors).toBe(true);
  });
});
