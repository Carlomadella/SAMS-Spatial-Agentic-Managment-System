import { db } from "./db";
import { log } from "./log";
import { defaultPermissions, loadPermissions, type Permissions } from "./permissions";
import type { SqlDriver } from "./sql";

/**
 * Permessi dell'agente all'avvio del task. Se la lettura fallisce si torna al default
 * ("Chiedi prima" su tutto), mai a "tutto consentito". undefined solo senza database
 * (test dei provider), dove non c'è nessuno a cui chiedere.
 */
export async function permissionsForTask(agentId: string): Promise<Permissions | undefined> {
  let d: SqlDriver;
  try {
    d = db();
  } catch {
    return undefined;
  }
  try {
    return await loadPermissions(d, agentId);
  } catch (err) {
    log.warn("Permessi dell'agente non letti: si usa «Chiedi prima»", { err: String(err) });
    return defaultPermissions();
  }
}
