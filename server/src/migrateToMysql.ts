/**
 * Porta i dati di un SAMS esistente da SQLite a MySQL, una volta sola.
 *
 *   SAMS_DB_URL=mysql://utente:password@host:3306/sams npm run db:to-mysql -- [percorso/.sams-data.db]
 *
 * Senza percorso usa il file di `SAMS_DATA_DIR` (o della cartella di lavoro). Il file
 * originale non viene modificato: si lavora su una copia temporanea. Il database MySQL
 * deve essere vuoto (le tabelle vengono create qui se mancano).
 */
import "dotenv/config";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { migrate, openDb, resolveSslCa } from "./db";
import { copyDatabase } from "./copyDb";
import { dataFile } from "./dataDir";
import { openMysql } from "./sql";

async function main(): Promise<void> {
  const url = (process.env.SAMS_DB_URL ?? "").trim();
  if (!url) throw new Error("Imposta SAMS_DB_URL (mysql://utente:password@host:3306/database)");
  const source = resolve(process.argv[2] ?? dataFile(".sams-data.db"));
  if (!existsSync(source)) throw new Error(`File SQLite non trovato: ${source}`);

  // Copia di lavoro: aprirlo lo migra allo schema corrente, e l'originale resta com'è.
  const tmp = mkdtempSync(join(tmpdir(), "sams-to-mysql-"));
  const work = join(tmp, "copia.db");
  copyFileSync(source, work);
  const src = await openDb(work);
  const dst = await openMysql({ url, sslCa: resolveSslCa(process.env.SAMS_DB_SSL_CA) });
  try {
    await migrate(dst);
    const counts = await copyDatabase(src, dst);
    console.log(`Copiato da ${source} a MySQL:`);
    for (const [table, n] of Object.entries(counts)) console.log(`  ${table.padEnd(20)} ${n}`);
  } finally {
    await src.close();
    await dst.close();
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`Migrazione non riuscita: ${(err as Error).message}`);
  process.exit(1);
});
