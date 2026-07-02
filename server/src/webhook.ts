import { createHmac, timingSafeEqual } from "node:crypto";

// Webhook GitHub in ingresso: verifica la firma e traduce l'evento in una
// notifica per la UI e, quando ha senso (CI fallita), in un suggerimento di
// "risveglio" — un task contestuale che il frontend assegna a un agente libero.
// Logica pura e testabile; l'endpoint in server.ts si limita a cablare.

export type WireLevel = "INFO" | "SUCCESS" | "WARN" | "ERROR" | "IDLE";

/** Task contestuale da far raccogliere a un agente libero. */
export interface WakeSuggestion {
  title: string;
  branch?: string;
  /** Frase breve sul perché del risveglio (per il log). */
  reason: string;
}

export interface WebhookResult {
  message: string;
  level: WireLevel;
  wake?: WakeSuggestion;
}

/**
 * Verifica la firma HMAC-SHA256 di GitHub (`x-hub-signature-256: sha256=…`).
 * Se `secret` è vuoto la verifica è disabilitata (ritorna `true`): utile in
 * locale. Confronto a tempo costante.
 */
export function verifyGithubSignature(secret: string, rawBody: string, signature: string | undefined): boolean {
  if (!secret) return true; // verifica disabilitata
  if (!signature || !signature.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual richiede lunghezze uguali: una diversa è già un mismatch.
  return a.length === b.length && timingSafeEqual(a, b);
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** Innaffiatura del Commit Garden derivata da un evento `push`. */
export interface PushWatering {
  /** Username GitHub di chi ha spinto (chiave del giardino). */
  user: string;
  /** Commit spinti (≈ innaffiature), coerente con il polling `fetchPushActivity`. */
  waterings: number;
  /** Timestamp dell'head commit: aggiorna `lastSeen` così il polling non riconta. */
  latestSeen: string | null;
}

/**
 * Estrae da un payload `push` chi innaffiare e di quanto. Ritorna null quando
 * non c'è nulla da innaffiare (nessun commit, es. creazione/eliminazione branch,
 * o autore mancante). Preferisce `sender.login` (username GitHub) al `pusher.name`
 * (che è il nome git, non necessariamente la login).
 */
export function parsePushWatering(body: Record<string, unknown>): PushWatering | null {
  const sender = body.sender as { login?: string } | undefined;
  const pusher = body.pusher as { name?: string } | undefined;
  const user = sender?.login ?? pusher?.name;
  if (!user) return null;
  const commits = Array.isArray(body.commits) ? body.commits.length : 0;
  if (commits <= 0) return null; // push senza commit: niente innaffiatura
  const head = body.head_commit as { timestamp?: string } | undefined;
  return { user, waterings: commits, latestSeen: head?.timestamp ?? null };
}

/**
 * Traduce un evento webhook GitHub in un `WebhookResult`, o `null` se l'evento
 * non ci interessa. Per la CI fallita allega un `wake` (fix contestuale).
 */
export function parseGithubEvent(event: string, body: Record<string, unknown>): WebhookResult | null {
  const repo = (body.repository as { full_name?: string } | undefined)?.full_name ?? "?";

  if (event === "push") {
    const branch = (str(body.ref) ?? "").replace("refs/heads/", "");
    const pusher = (body.pusher as { name?: string } | undefined)?.name ?? "?";
    const commits = Array.isArray(body.commits) ? body.commits.length : 0;
    return {
      level: "INFO",
      message: `Push su ${repo}/${branch} da ${pusher} (${commits} commit${commits !== 1 ? "s" : ""})`,
    };
  }

  if (event === "pull_request") {
    const action = str(body.action);
    const pr = body.pull_request as
      | { title?: string; html_url?: string; number?: number; head?: { ref?: string } }
      | undefined;
    if (!pr) return null;
    const num = pr.number ?? "?";
    const head = pr.head?.ref;
    if (action === "opened" || action === "closed" || action === "merged") {
      return {
        level: "SUCCESS",
        message: `PR #${num} ${action}: ${pr.title ?? ""} — ${pr.html_url ?? ""}`,
      };
    }
    if (action === "review_requested" && head) {
      return {
        level: "WARN",
        message: `Review richiesta su PR #${num}: ${pr.title ?? ""} — ${pr.html_url ?? ""}`,
        wake: {
          title: `Rivedi la PR #${num} ("${pr.title ?? ""}") sul branch ${head}: leggi i file modificati con gh_read_pr/gh_read_file e commenta bug, stile, sicurezza e performance con gh_comment_pr.`,
          branch: head,
          reason: `review richiesta su PR #${num}`,
        },
      };
    }
    return null;
  }

  if (event === "workflow_run") {
    const run = body.workflow_run as { name?: string; conclusion?: string; html_url?: string; head_branch?: string } | undefined;
    const action = str(body.action);
    if (run && action === "completed") {
      const ok = run.conclusion === "success";
      const name = run.name ?? "?";
      const branch = run.head_branch ?? "";
      const base: WebhookResult = {
        level: ok ? "SUCCESS" : "ERROR",
        message: `CI "${name}" ${ok ? "✅ passata" : "❌ fallita"}${branch ? ` su ${branch}` : ""} — ${run.html_url ?? ""}`,
      };
      if (!ok && branch) {
        base.wake = {
          title: `Indaga e correggi la CI fallita ("${name}") sul branch ${branch}: leggi i job falliti con gh_list_ci/gh_ci_jobs, applica il fix e verifica che torni verde.`,
          branch,
          reason: `CI "${name}" fallita su ${branch}`,
        };
      }
      return base;
    }
    return null;
  }

  return null;
}
