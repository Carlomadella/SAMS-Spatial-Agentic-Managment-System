import { describe, expect, it, vi } from "vitest";
import {
  createMailer,
  mailerCanDeliver,
  memoryMailer,
  normalizeBaseUrl,
  renderResetEmail,
  renderVerifyEmail,
  resetLink,
  resolveMailerConfig,
  verifyLink,
} from "./mailer";

describe("normalizeBaseUrl", () => {
  it("toglie lo slash finale (niente doppio slash nei link)", () => {
    expect(normalizeBaseUrl("https://sams.io/")).toBe("https://sams.io");
    expect(normalizeBaseUrl("https://sams.io")).toBe("https://sams.io");
  });

  it("ricade sul default per valori vuoti o non stringa", () => {
    expect(normalizeBaseUrl("")).toBe("http://localhost:5173");
    expect(normalizeBaseUrl("   ")).toBe("http://localhost:5173");
    expect(normalizeBaseUrl(undefined)).toBe("http://localhost:5173");
    expect(normalizeBaseUrl(42)).toBe("http://localhost:5173");
  });
});

describe("resolveMailerConfig", () => {
  it("senza configurazione → driver console (SAMS resta usabile appena scaricato)", () => {
    const c = resolveMailerConfig({});
    expect(c.driver).toBe("console");
    expect(c.baseUrl).toBe("http://localhost:5173");
    expect(c.from).toBe("SAMS <noreply@sams.local>");
  });

  it("SMTP_HOST → driver smtp, con porta 587 di default", () => {
    const c = resolveMailerConfig({ SMTP_HOST: "smtp.x.it", SMTP_USER: "u", SMTP_PASS: "p" });
    expect(c.driver).toBe("smtp");
    expect(c.smtp).toEqual({ host: "smtp.x.it", port: 587, user: "u", pass: "p", secure: false });
  });

  it("la porta 465 implica secure, senza doverlo dichiarare", () => {
    expect(resolveMailerConfig({ SMTP_HOST: "s", SMTP_PORT: "465" }).smtp?.secure).toBe(true);
    expect(resolveMailerConfig({ SMTP_HOST: "s", SMTP_PORT: "587" }).smtp?.secure).toBe(false);
  });

  it("SMTP_SECURE=true forza secure anche su porte non 465", () => {
    expect(resolveMailerConfig({ SMTP_HOST: "s", SMTP_PORT: "2525", SMTP_SECURE: "true" }).smtp?.secure).toBe(true);
  });

  it("una porta illeggibile o fuori range ricade su 587 invece di propagare NaN", () => {
    expect(resolveMailerConfig({ SMTP_HOST: "s", SMTP_PORT: "non-un-numero" }).smtp?.port).toBe(587);
    expect(resolveMailerConfig({ SMTP_HOST: "s", SMTP_PORT: "0" }).smtp?.port).toBe(587);
    expect(resolveMailerConfig({ SMTP_HOST: "s", SMTP_PORT: "99999" }).smtp?.port).toBe(587);
  });

  it("RESEND_API_KEY (senza SMTP) → driver resend", () => {
    const c = resolveMailerConfig({ RESEND_API_KEY: "re_123" });
    expect(c.driver).toBe("resend");
    expect(c.resendApiKey).toBe("re_123");
  });

  it("con entrambi, SMTP vince (è la configurazione più esplicita)", () => {
    expect(resolveMailerConfig({ SMTP_HOST: "s", RESEND_API_KEY: "re_1" }).driver).toBe("smtp");
  });

  it("legge mittente e origine pubblica dall'env", () => {
    const c = resolveMailerConfig({ SAMS_MAIL_FROM: "SAMS <no@x.it>", SAMS_PUBLIC_URL: "https://sams.x.it/" });
    expect(c.from).toBe("SAMS <no@x.it>");
    expect(c.baseUrl).toBe("https://sams.x.it");
  });

  it("valori solo-spazi contano come non configurati", () => {
    expect(resolveMailerConfig({ SMTP_HOST: "   ", RESEND_API_KEY: "  " }).driver).toBe("console");
  });
});

describe("mailerCanDeliver", () => {
  it("solo smtp e resend recapitano davvero", () => {
    expect(mailerCanDeliver({ driver: "smtp" })).toBe(true);
    expect(mailerCanDeliver({ driver: "resend" })).toBe(true);
  });

  it("console non recapita → il gate di verifica resta spento", () => {
    expect(mailerCanDeliver({ driver: "console" })).toBe(false);
  });
});

describe("link", () => {
  it("costruisce le route del sito", () => {
    expect(resetLink("https://sams.io", "abc")).toBe("https://sams.io/reset?token=abc");
    expect(verifyLink("https://sams.io", "abc")).toBe("https://sams.io/verifica?token=abc");
  });

  it("normalizza la base (nessun doppio slash)", () => {
    expect(resetLink("https://sams.io/", "abc")).toBe("https://sams.io/reset?token=abc");
  });

  it("percent-encoda il token invece di romperlo nella query", () => {
    expect(resetLink("https://sams.io", "a b&c=d")).toBe("https://sams.io/reset?token=a%20b%26c%3Dd");
  });
});

describe("rendering delle email", () => {
  it("il reset contiene il link e nomina la persona", () => {
    const msg = renderResetEmail("Carlo", "https://sams.io/reset?token=t1");
    expect(msg.text).toContain("https://sams.io/reset?token=t1");
    expect(msg.text).toContain("Ciao Carlo,");
    expect(msg.subject).toMatch(/password/i);
  });

  it("la verifica contiene il link", () => {
    const msg = renderVerifyEmail("Ada", "https://sams.io/verifica?token=t2");
    expect(msg.text).toContain("https://sams.io/verifica?token=t2");
    expect(msg.subject).toMatch(/email/i);
  });

  it("senza nome il saluto resta leggibile (niente «Ciao ,»)", () => {
    expect(renderResetEmail("", "L").text).toContain("Ciao,");
    expect(renderVerifyEmail("", "L").text).toContain("Ciao,");
  });

  it("il reset dice che il link è monouso e come ignorarlo", () => {
    const t = renderResetEmail("Carlo", "L").text;
    expect(t).toMatch(/monouso/i);
    expect(t).toMatch(/ignora/i);
  });
});

describe("createMailer", () => {
  it("costruisce il driver richiesto", () => {
    expect(createMailer({ driver: "console", from: "f", baseUrl: "b" }).driver).toBe("console");
    expect(createMailer({ driver: "resend", from: "f", baseUrl: "b", resendApiKey: "k" }).driver).toBe("resend");
    expect(createMailer({ driver: "smtp", from: "f", baseUrl: "b", smtp: { host: "h", port: 587, user: "", pass: "", secure: false } }).driver).toBe("smtp");
  });

  it("console non lancia e non spedisce nulla", async () => {
    const m = createMailer({ driver: "console", from: "f", baseUrl: "b" });
    await expect(m.send({ to: "a@b.it", subject: "s", text: "t" })).resolves.toBeUndefined();
  });

  it("resend fa una POST autenticata all'API con il messaggio", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const m = createMailer({ driver: "resend", from: "SAMS <no@x.it>", baseUrl: "b", resendApiKey: "re_k" });
    await m.send({ to: "a@b.it", subject: "s", text: "corpo" });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_k");
    expect(JSON.parse(init.body as string)).toEqual({
      from: "SAMS <no@x.it>",
      to: ["a@b.it"],
      subject: "s",
      text: "corpo",
    });
    fetchSpy.mockRestore();
  });

  it("resend lancia se l'API rifiuta (il chiamante logga, non muore)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("dominio non verificato", { status: 403 }));
    const m = createMailer({ driver: "resend", from: "f", baseUrl: "b", resendApiKey: "k" });
    await expect(m.send({ to: "a@b.it", subject: "s", text: "t" })).rejects.toThrow(/403/);
    fetchSpy.mockRestore();
  });
});

describe("memoryMailer", () => {
  it("accumula i messaggi invece di spedirli", async () => {
    const m = memoryMailer();
    await m.send({ to: "a@b.it", subject: "s", text: "t" });
    await m.send({ to: "c@d.it", subject: "s2", text: "t2" });
    expect(m.sent).toHaveLength(2);
    expect(m.sent[0].to).toBe("a@b.it");
    expect(m.sent[1].subject).toBe("s2");
  });
});
