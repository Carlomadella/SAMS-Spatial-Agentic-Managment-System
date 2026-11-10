import fs from "node:fs";
import path from "node:path";

// Dove il runtime tiene i suoi file durevoli: il database SQLite (`.sams-data.db`:
// account, sessioni, chat, mondo, routine, cronologia) e le impostazioni salvate
// (`.sams-runtime.json`). Di default è la cartella di lavoro del server, come sempre.
// In produzione `SAMS_DATA_DIR` la sposta su un disco persistente (su Render il `disk:`
// di render.yaml): senza, a ogni deploy o riavvio i dati sparirebbero col container.

/** La cartella dati: `SAMS_DATA_DIR` (relativa alla cartella di lavoro se non assoluta) o la cartella di lavoro. */
export function resolveDataDir(env: NodeJS.ProcessEnv = process.env, cwd: string = process.cwd()): string {
  const raw = (env.SAMS_DATA_DIR ?? "").trim();
  return raw ? path.resolve(cwd, raw) : cwd;
}

/** Percorso di un file nella cartella dati; crea la cartella se non esiste ancora. */
export function dataFile(name: string, env: NodeJS.ProcessEnv = process.env, cwd: string = process.cwd()): string {
  const dir = resolveDataDir(env, cwd);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, name);
}
