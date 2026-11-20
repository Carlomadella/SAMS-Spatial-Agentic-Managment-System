import type { EnvironmentName } from "../types";

export type EnvBranches = Record<EnvironmentName, string>;

export const NO_ENV_BRANCHES: EnvBranches = { dev: "", staging: "", prod: "" };

/**
 * Da quale branch partono i task nell'ambiente scelto: quello impostato dall'owner per
 * l'ambiente, altrimenti il branch base del runtime ("" se il runtime non l'ha detto).
 * Stessa regola del server (`envBaseBranch`).
 */
export function effectiveBranch(env: EnvironmentName, envBranches: EnvBranches, runtimeBranch: string): { branch: string; dedicated: boolean } {
  const own = envBranches[env]?.trim() ?? "";
  return own ? { branch: own, dedicated: true } : { branch: runtimeBranch, dedicated: false };
}

/** Normalizza ciò che arriva dal runtime (i runtime vecchi non mandano `envBranches`). */
export function readEnvBranches(raw: unknown): EnvBranches {
  if (!raw || typeof raw !== "object") return NO_ENV_BRANCHES;
  const r = raw as Record<string, unknown>;
  const pick = (k: EnvironmentName) => (typeof r[k] === "string" ? (r[k] as string) : "");
  return { dev: pick("dev"), staging: pick("staging"), prod: pick("prod") };
}
