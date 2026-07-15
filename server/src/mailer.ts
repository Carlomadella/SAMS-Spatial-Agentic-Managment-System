// Canale email — il pezzo che mancava per completare la gestione password (Roadmap 4,
// frontiera #3; doc di decisione 2026-07-15). Reset e verifica hanno un problema comune:
// recapitare un token a chi **non ha una sessione**. Serve un canale, ma SAMS è software
// che altri ospitano: non possiamo pretendere che chi lo prova abbia un SMTP.
//
// Perciò un'astrazione a **driver**, scelta dall'env:
//
//   SMTP_HOST configurato       → `smtp`    (nodemailer, import dinamico)
//   RESEND_API_KEY configurato  → `resend`  (fetch, nessuna dipendenza)
//   niente configurato          → `console` — il link finisce nei log del server, e
//                                 l'owner può generarlo dalla UsersAdmin (fallback)
//
// Il driver `console` non è un mozzicone per lo sviluppo: è il modo in cui SAMS resta
// usabile appena scaricato, senza secret da compilare. Da esso discende la regola del
// gate di verifica in `server.ts` (si blocca il login dei non verificati **solo** con un
// canale reale configurato — vedi `mailerCanDeliver`).

import { log } from "./log";

export type MailerDriver = "smtp" | "resend" | "console";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
}

export interface MailerConfig {
  driver: MailerDriver;
  /** Mittente ("SAMS <noreply@…>"). */
  from: string;
  /** Origine pubblica su cui costruire i link (senza slash finale). */
  baseUrl: string;
  smtp?: SmtpConfig;
  resendApiKey?: string;
}

export interface Mailer {
  readonly driver: MailerDriver;
  send(msg: MailMessage): Promise<void>;
}

const DEFAULT_BASE_URL = "http://localhost:5173";
const DEFAULT_FROM = "SAMS <noreply@sams.local>";

/** Via lo slash finale, così `${baseUrl}/reset` non produce mai un doppio slash. */
export function normalizeBaseUrl(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return DEFAULT_BASE_URL;
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

/**
 * Sceglie il driver dall'ambiente. Puro: l'env arriva come parametro, così i test
 * coprono ogni combinazione senza toccare `process.env`.
 *
 * SMTP ha la precedenza su Resend quando ci sono entrambi: è la configurazione più
 * esplicita delle due (host+credenziali contro una sola chiave), quindi chi l'ha
 * compilata l'ha voluta davvero.
 */
export function resolveMailerConfig(env: NodeJS.ProcessEnv = process.env): MailerConfig {
  const baseUrl = normalizeBaseUrl(env.SAMS_PUBLIC_URL);
  const from = (env.SAMS_MAIL_FROM || "").trim() || DEFAULT_FROM;
  const host = (env.SMTP_HOST || "").trim();
  const resendApiKey = (env.RESEND_API_KEY || "").trim();

  if (host) {
    const port = Number.parseInt((env.SMTP_PORT || "").trim(), 10);
    const validPort = Number.isFinite(port) && port > 0 && port <= 65535 ? port : 587;
    return {
      driver: "smtp",
      from,
      baseUrl,
      smtp: {
        host,
        port: validPort,
        user: (env.SMTP_USER || "").trim(),
        pass: env.SMTP_PASS || "",
        // Implicito su 465; altrove STARTTLS (nodemailer negozia da sé).
        secure: (env.SMTP_SECURE || "").trim() === "true" || validPort === 465,
      },
    };
  }
  if (resendApiKey) return { driver: "resend", from, baseUrl, resendApiKey };
  return { driver: "console", from, baseUrl };
}

/**
 * `true` se il canale recapita davvero a una casella. Il driver `console` scrive solo
 * nei log del server, quindi non conta: da questo dipende il gate di verifica (senza
 * canale nessuno potrebbe verificarsi, e bloccare i non verificati chiuderebbe fuori
 * tutti — stessa forma della regola dei ruoli, "nessun token configurato → tutto owner").
 */
export function mailerCanDeliver(config: Pick<MailerConfig, "driver">): boolean {
  return config.driver === "smtp" || config.driver === "resend";
}

/** Link di reset password da mettere nell'email (o da consegnare a mano). */
export function resetLink(baseUrl: string, token: string): string {
  return `${normalizeBaseUrl(baseUrl)}/reset?token=${encodeURIComponent(token)}`;
}

/** Link di verifica email. */
export function verifyLink(baseUrl: string, token: string): string {
  return `${normalizeBaseUrl(baseUrl)}/verifica?token=${encodeURIComponent(token)}`;
}

/** Corpo dell'email di reset. Puro → il test asserisce che il link ci sia davvero. */
export function renderResetEmail(name: string, link: string): MailMessage {
  const who = name ? ` ${name}` : "";
  return {
    to: "",
    subject: "Reimposta la tua password SAMS",
    text: [
      `Ciao${who},`,
      "",
      "hai chiesto di reimpostare la password del tuo account SAMS.",
      "Apri questo link entro un'ora per sceglierne una nuova:",
      "",
      link,
      "",
      "Il link è monouso e scade dopo un'ora. Se non hai chiesto tu il reset,",
      "ignora questo messaggio: la tua password resta quella di prima.",
      "",
      "— SAMS",
    ].join("\n"),
  };
}

/** Corpo dell'email di verifica dell'indirizzo. */
export function renderVerifyEmail(name: string, link: string): MailMessage {
  const who = name ? ` ${name}` : "";
  return {
    to: "",
    subject: "Conferma il tuo indirizzo email — SAMS",
    text: [
      `Ciao${who},`,
      "",
      "conferma il tuo indirizzo per attivare l'account SAMS:",
      "",
      link,
      "",
      "Il link scade tra 24 ore. Se non ti sei registrato tu, ignora questo messaggio.",
      "",
      "— SAMS",
    ].join("\n"),
  };
}

/**
 * Driver `console`: nessun invio, il messaggio finisce nei log strutturati. Il link è
 * loggato in chiaro **di proposito** — è il fallback documentato per chi ospita SAMS
 * senza SMTP, ed è l'unico modo di recuperare il token senza un canale.
 */
function consoleMailer(): Mailer {
  return {
    driver: "console",
    async send(msg) {
      log.info("Email non spedita (nessun canale configurato) — link nei log", {
        to: msg.to,
        subject: msg.subject,
        body: msg.text,
      });
    },
  };
}

/** Driver `resend`: una POST a un'API REST, nessuna dipendenza. */
function resendMailer(config: MailerConfig): Mailer {
  return {
    driver: "resend",
    async send(msg) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: config.from, to: [msg.to], subject: msg.subject, text: msg.text }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Resend ha risposto ${res.status}: ${detail.slice(0, 200)}`);
      }
    },
  };
}

/**
 * Driver `smtp`: nodemailer, importato **dinamicamente** così il pacchetto viene
 * caricato solo da chi ha configurato un SMTP (il boot di chi non lo usa resta
 * identico a prima).
 */
function smtpMailer(config: MailerConfig): Mailer {
  return {
    driver: "smtp",
    async send(msg) {
      const { createTransport } = await import("nodemailer");
      const smtp = config.smtp!;
      const transport = createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
      });
      await transport.sendMail({ from: config.from, to: msg.to, subject: msg.subject, text: msg.text });
    },
  };
}

/** Costruisce il mailer del driver scelto. */
export function createMailer(config: MailerConfig): Mailer {
  if (config.driver === "smtp") return smtpMailer(config);
  if (config.driver === "resend") return resendMailer(config);
  return consoleMailer();
}

/**
 * Mailer di prova: accumula i messaggi in memoria invece di spedirli. Vive qui (e non
 * nei test) perché serve anche a chi vuole provare il flusso end-to-end senza un SMTP.
 */
export function memoryMailer(): Mailer & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    driver: "console",
    sent,
    async send(msg) {
      sent.push(msg);
    },
  };
}
