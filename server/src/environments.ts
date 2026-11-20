// Ambienti Dev/Staging/Prod: ognuno è un branch base della repo. L'owner li imposta
// in ⚙ (o con SAMS_BRANCH_DEV / _STAGING / _PROD); il task porta l'ambiente scelto e
// il server lo traduce qui nel branch da cui partire (e verso cui aprire la PR).
// Un ambiente senza branch lascia il branch base solito (del server o dell'utente).

import { isValidBranchName } from "./githubAccounts";

export const ENVIRONMENTS = ["dev", "staging", "prod"] as const;
export type EnvironmentName = (typeof ENVIRONMENTS)[number];

export interface EnvBranchSettings {
  devBranch: string;
  stagingBranch: string;
  prodBranch: string;
}

const KEY: Record<EnvironmentName, keyof EnvBranchSettings> = {
  dev: "devBranch",
  staging: "stagingBranch",
  prod: "prodBranch",
};

export function isEnvironment(v: unknown): v is EnvironmentName {
  return typeof v === "string" && (ENVIRONMENTS as readonly string[]).includes(v);
}

/** Il branch base per l'ambiente del task, o null (ambiente ignoto, non impostato o non valido). */
export function envBaseBranch(env: unknown, s: EnvBranchSettings): string | null {
  if (!isEnvironment(env)) return null;
  const branch = s[KEY[env]].trim();
  return branch && isValidBranchName(branch) ? branch : null;
}

/** I branch dei tre ambienti, per la UI ("" = non impostato). */
export function envBranches(s: EnvBranchSettings): Record<EnvironmentName, string> {
  return { dev: s.devBranch, staging: s.stagingBranch, prod: s.prodBranch };
}

export { KEY as ENV_BRANCH_KEY };
export { isValidBranchName };
