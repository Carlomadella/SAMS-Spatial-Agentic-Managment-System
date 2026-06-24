import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { config, useMysql } from "./config";
import type { GardenState } from "./garden";

export interface Store {
  get(user: string): Promise<GardenState | null>;
  put(state: GardenState): Promise<void>;
  top(limit: number): Promise<GardenState[]>;
}

class MemoryStore implements Store {
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

class MysqlStore implements Store {
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

let store: Store = new MemoryStore();
let kind = "in-memory";

export async function initStore(): Promise<string> {
  if (!useMysql) return kind;
  try {
    const pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.name,
      connectionLimit: 5,
    });
    await pool.query(
      "CREATE TABLE IF NOT EXISTS gardens (" +
        "user VARCHAR(100) PRIMARY KEY, waterings INT NOT NULL DEFAULT 0, " +
        "data JSON NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)",
    );
    await pool.query("SELECT 1");
    store = new MysqlStore(pool);
    kind = "mysql";
  } catch (e) {
    console.warn("⚠️  MySQL non disponibile, uso lo store in-memory:", (e as Error).message);
  }
  return kind;
}

export function getStore(): Store {
  return store;
}
