import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import type { GardenState } from "./model";

export interface GardenStore {
  get(user: string): Promise<GardenState | null>;
  put(state: GardenState): Promise<void>;
  top(limit: number): Promise<GardenState[]>;
}

class MemoryStore implements GardenStore {
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

class MysqlStore implements GardenStore {
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

/** Use MySQL when DB_HOST is set, otherwise keep the in-memory store. */
export async function initGardenStore(): Promise<string> {
  if (!process.env.DB_HOST) return "in-memory";
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
    await pool.query("SELECT 1");
    store = new MysqlStore(pool);
    return "mysql";
  } catch (e) {
    console.warn("⚠️  Garden: MySQL non disponibile, uso store in-memory:", (e as Error).message);
    return "in-memory";
  }
}

export function getStore(): GardenStore {
  return store;
}
