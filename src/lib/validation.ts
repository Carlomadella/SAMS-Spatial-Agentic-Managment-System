/**
 * Lightweight client-side validators that mirror the runtime's own checks, so
 * the UI can warn early instead of letting a malformed value fail later with a
 * confusing server error.
 */

/** GitHub `owner/repo` slug. Mirrors the server-side check in github.ts. */
export function isValidRepo(repo: string): boolean {
  return /^[\w.-]+\/[\w.-]+$/.test(repo.trim());
}

/**
 * True when the text still contains an unfilled task-template placeholder such as
 * `{argomento}` or `{pagina}`. Used to block assigning a template before its
 * placeholders are replaced with real values.
 */
export function hasUnfilledPlaceholders(text: string): boolean {
  return /\{[^}]+\}/.test(text);
}
