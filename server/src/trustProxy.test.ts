import express from "express";
import { describe, expect, it } from "vitest";
import { parseTrustProxy } from "./trustProxy";

describe("parseTrustProxy", () => {
  it("non impostata o spenta: nessuna fiducia", () => {
    for (const raw of [undefined, "", "  ", "false", "0"]) {
      expect(parseTrustProxy(raw)).toEqual({ value: false });
    }
  });
  it("rifiuta true, che renderebbe l'IP falsificabile", () => {
    const r = parseTrustProxy("true");
    expect(r.value).toBe(false);
    expect(r.warning).toMatch(/falsificare/);
  });
  it("accetta un numero di hop tra 1 e 10", () => {
    expect(parseTrustProxy("1")).toEqual({ value: 1 });
    expect(parseTrustProxy(" 2 ")).toEqual({ value: 2 });
    expect(parseTrustProxy("11").value).toBe(false);
    expect(parseTrustProxy("11").warning).toBeDefined();
  });
  it("accetta elenchi di IP, CIDR e preset di Express", () => {
    expect(parseTrustProxy("loopback, 10.0.0.0/8,::1")).toEqual({ value: "loopback, 10.0.0.0/8, ::1" });
  });
  it("rifiuta voci non valide", () => {
    for (const raw of ["10.0.0.0/33", "abc", "1.2.3.4, nope", "-1", "1.5"]) {
      const r = parseTrustProxy(raw);
      expect(r.value).toBe(false);
      expect(r.warning).toBeDefined();
    }
  });
});

describe("trust proxy con Express (proxy che aggiunge in fondo, come Render)", () => {
  function ipFor(setting: false | number | string, xff: string): Promise<string | undefined> {
    const app = express();
    app.set("trust proxy", setting);
    return new Promise((resolve) => {
      const req = { headers: { "x-forwarded-for": xff }, socket: { remoteAddress: "10.0.0.5" }, connection: { remoteAddress: "10.0.0.5" } };
      Object.setPrototypeOf(req, app.request);
      (req as unknown as { app: unknown }).app = app;
      resolve((req as unknown as { ip?: string }).ip);
    });
  }
  it("con 1 hop prende l'IP aggiunto dal proxy, non quello scritto dal client", async () => {
    // il client manda "6.6.6.6" falso, il proxy aggiunge l'IP vero 203.0.113.7
    expect(await ipFor(1, "6.6.6.6, 203.0.113.7")).toBe("203.0.113.7");
  });
  it("senza fiducia resta l'IP del proxy", async () => {
    expect(await ipFor(false, "203.0.113.7")).toBe("10.0.0.5");
  });
});
