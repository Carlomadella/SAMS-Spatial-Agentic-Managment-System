import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import type { GardenState } from "./model";
import { db, getGarden, putGarden, topGardens } from "../db";

export interface GardenStore {
  get(user: string): Promise<GardenState | null>;
  put(state: GardenState): Promise<void>;
  top(limit: number): Promise<GardenState[]>;
}

/** Solo per i test e se il database non è ancora pronto: si azzera a ogni riavvio. */
export class MemoryStore implements GardenStore {
  private m = new Map<string, GardenState>();
  async get(user: string) {
    return this.m.get(user.toLowerCase()) ?? null;
  }
  async put(s: GardenState) {
    this.m.set(s.user.toLowerCase(), s);
  }
  async top(limit: number) {
    return [...this.m.values()].sort((a, b) => b.waterings - a.waterings).slice(0, limit);
  }
}

/** Il database principale di SAMS (SQLite in locale, MySQL/TiDB in produzione): sopravvive ai riavvii. */
export class SamsDbStore implements GardenStore {
  get(user: string) {
    return getGarden(db(), user);
  }
  put(s: GardenState) {
    return putGarden(db(), s);
  }
  top(limit: number) {
    return topGardens(db(), limit);
  }
}

/** Ripiego storico: un MySQL separato indicato da `DB_HOST` (tabella `gardens` con colonna `user`). */
class LegacyMysqlStore implements GardenStore {
  constructor(private pool: Pool) {}
  async get(user: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT data FROM gardens WHERE user = ?", [
      user.toLowerCase(),
    ]);
    const row = rows[0];
    return row ? (JSON.parse(row.data as string) as GardenState) : null;
  }
  async put(s: GardenState) {
    await this.pool.query(
      "INSERT INTO gardens (user, waterings, data) VALUES (?, ?, ?) " +
        "ON DUPLICATE KEY UPDATE waterings = VALUES(waterings), data = VALUES(data)",
      [s.user.toLowerCase(), s.waterings, JSON.stringify(s)],
    );
  }
  async top(limit: number) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT data FROM gardens ORDER BY waterings DESC LIMIT ?",
      [limit],
    );
    return rows.map((r) => JSON.parse(r.data as string) as GardenState);
  }
}

let store: GardenStore = new MemoryStore();

/**
 * Sceglie dove vivono i giardini. Di norma nel database di SAMS (va chiamata dopo `initDb()`).
 * Se è impostato `DB_HOST` (configurazione vecchia, database separato) si usa quello, così
 * chi lo aveva non perde i giardini; se non risponde si torna al database di SAMS.
 */
export async function initGardenStore(): Promise<string> {
  if (process.env.DB_HOST) {
    try {
      const pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT ?? 3306),
        user: process.env.DB_USER ?? "root",
        password: process.env.DB_PASSWORD ?? "",
        database: process.env.DB_NAME ?? "sams_garden",
        connectionLimit: 5,
      });
      await pool.query(
        "CREATE TABLE IF NOT EXISTS gardens (" +
          "user VARCHAR(100) PRIMARY KEY, waterings INT NOT NULL DEFAULT 0, " +
          "data JSON NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)",
      );
      store = new LegacyMysqlStore(pool);
      return "mysql (DB_HOST)";
    } catch (e) {
      console.warn("⚠️  Garden: DB_HOST non raggiungibile, uso il database di SAMS:", (e as Error).message);
    }
  }
  db(); // lancia se initDb() non è ancora stato chiamato
  store = new SamsDbStore();
  return "database SAMS";
}

/** Per i test: sostituisce lo store attivo. */
export function setGardenStore(s: GardenStore): void {
  store = s;
}

export function getStore(): GardenStore {
  return store;
}
