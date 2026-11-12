import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

/**
 * Driver SQL asincrono e minimo sopra cui vive `db.ts`: le stesse funzioni di dominio
 * girano su **SQLite** (file locale, sviluppo e test, zero configurazione) o su **MySQL**
 * (produzione, `SAMS_DB_URL`). Le poche differenze di dialetto restano in `db.ts`,
 * guardando `dialect`; qui ci sono solo connessione, query e transazioni.
 */
export type Dialect = "sqlite" | "mysql";
export type SqlValue = string | number | null;
export type Row = Record<string, unknown>;

export interface SqlRunner {
  readonly dialect: Dialect;
  all<T = Row>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T = Row>(sql: string, params?: SqlValue[]): Promise<T | undefined>;
  /** INSERT/UPDATE/DELETE: quante righe ha toccato (righe *trovate* per un UPDATE, come SQLite). */
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
}

export interface SqlDriver extends SqlRunner {
  /** Uno o più statement DDL senza parametri. */
  exec(sql: string): Promise<void>;
  /** Esegue `fn` in una transazione: commit se risolve, rollback se lancia. */
  transaction<T>(fn: (tx: SqlRunner) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/**
 * Coda FIFO asincrona: un solo detentore alla volta. Serve a SQLite, dove una
 * transazione è aperta sull'unica connessione: senza coda, una query di un'altra
 * richiesta potrebbe infilarsi tra due `await` della transazione e finirci dentro.
 */
export class Mutex {
  private tail: Promise<void> = Promise.resolve();

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((r) => (release = r));
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

// --- SQLite (node:sqlite) ----------------------------------------------------

class SqliteDriver implements SqlDriver {
  readonly dialect = "sqlite" as const;
  private lock = new Mutex();
  /** Il runner "dentro la transazione": stesse query, ma senza ripassare dalla coda. */
  private inner: SqlRunner;

  constructor(private db: DatabaseSync) {
    const raw = this.db;
    this.inner = {
      dialect: "sqlite",
      all: async <T>(sql: string, params: SqlValue[] = []) => raw.prepare(sql).all(...(params as SQLInputValue[])) as T[],
      get: async <T>(sql: string, params: SqlValue[] = []) =>
        raw.prepare(sql).get(...(params as SQLInputValue[])) as T | undefined,
      run: async (sql: string, params: SqlValue[] = []) => ({
        changes: Number(raw.prepare(sql).run(...(params as SQLInputValue[])).changes ?? 0),
      }),
    };
  }

  all<T = Row>(sql: string, params?: SqlValue[]): Promise<T[]> {
    return this.lock.run(() => this.inner.all<T>(sql, params));
  }
  get<T = Row>(sql: string, params?: SqlValue[]): Promise<T | undefined> {
    return this.lock.run(() => this.inner.get<T>(sql, params));
  }
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }> {
    return this.lock.run(() => this.inner.run(sql, params));
  }
  exec(sql: string): Promise<void> {
    return this.lock.run(async () => this.db.exec(sql));
  }
  transaction<T>(fn: (tx: SqlRunner) => Promise<T>): Promise<T> {
    return this.lock.run(async () => {
      this.db.exec("BEGIN");
      try {
        const out = await fn(this.inner);
        this.db.exec("COMMIT");
        return out;
      } catch (err) {
        this.db.exec("ROLLBACK");
        throw err;
      }
    });
  }
  async close(): Promise<void> {
    this.db.close();
  }
}

/** Apre (o crea) un database SQLite. `":memory:"` nei test. */
export function openSqlite(location: string): SqlDriver {
  return new SqliteDriver(new DatabaseSync(location));
}

// --- MySQL (mysql2) ----------------------------------------------------------

type Queryable = Pool | PoolConnection;

function mysqlRunner(q: Queryable): SqlRunner {
  return {
    dialect: "mysql",
    // `query` (escape lato client) e non `execute`: i prepared statement di MySQL non
    // accettano `LIMIT ?`, che qui si usa spesso.
    all: async <T>(sql: string, params: SqlValue[] = []) => {
      const [rows] = await q.query<RowDataPacket[]>(sql, params);
      return rows as unknown as T[];
    },
    get: async <T>(sql: string, params: SqlValue[] = []) => {
      const [rows] = await q.query<RowDataPacket[]>(sql, params);
      return rows[0] as unknown as T | undefined;
    },
    run: async (sql: string, params: SqlValue[] = []) => {
      const [res] = await q.query<ResultSetHeader>(sql, params);
      return { changes: Number(res.affectedRows ?? 0) };
    },
  };
}

class MysqlDriver implements SqlDriver {
  readonly dialect = "mysql" as const;
  private base: SqlRunner;

  constructor(private pool: Pool) {
    this.base = mysqlRunner(pool);
  }

  all<T = Row>(sql: string, params?: SqlValue[]): Promise<T[]> {
    return this.base.all<T>(sql, params);
  }
  get<T = Row>(sql: string, params?: SqlValue[]): Promise<T | undefined> {
    return this.base.get<T>(sql, params);
  }
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }> {
    return this.base.run(sql, params);
  }
  async exec(sql: string): Promise<void> {
    // Il pool ha `multipleStatements` spento (difesa in profondità contro l'iniezione):
    // gli statement DDL si eseguono uno per volta.
    for (const stmt of splitStatements(sql)) await this.pool.query(stmt);
  }
  async transaction<T>(fn: (tx: SqlRunner) => Promise<T>): Promise<T> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      try {
        const out = await fn(mysqlRunner(conn));
        await conn.commit();
        return out;
      } catch (err) {
        await conn.rollback();
        throw err;
      }
    } finally {
      conn.release();
    }
  }
  async close(): Promise<void> {
    await this.pool.end();
  }
}

/** Divide un blocco DDL nei singoli statement (niente `;` dentro stringhe nel nostro DDL). */
export function splitStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter((s) => s.length > 0);
}

export interface MysqlOptions {
  /** `mysql://utente:password@host:porta/database` */
  url: string;
  /** Certificato CA in PEM per TLS (es. Aiven). Assente = TLS solo se l'URL lo chiede. */
  sslCa?: string;
}

/**
 * Apre un pool MySQL e verifica subito la connessione: se il DB configurato non
 * risponde il server non deve partire facendo finta di niente (perderebbe i dati
 * scrivendo altrove).
 */
export async function openMysql(opts: MysqlOptions): Promise<SqlDriver> {
  const u = new URL(opts.url);
  if (u.protocol !== "mysql:") throw new Error("SAMS_DB_URL deve iniziare con mysql://");
  const database = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (!database) throw new Error("SAMS_DB_URL deve indicare il database (mysql://…/nome_db)");
  const sslMode = (u.searchParams.get("ssl-mode") ?? u.searchParams.get("ssl") ?? "").toLowerCase();
  const wantsTls = Boolean(opts.sslCa) || ["required", "require", "true", "verify_ca", "verify_identity"].includes(sslMode);
  const pool = mysql.createPool({
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database,
    connectionLimit: 5,
    charset: "utf8mb4",
    // BIGINT come number: i timestamp in ms (≈1,7e12) stanno ben dentro gli interi sicuri.
    supportBigNumbers: true,
    bigNumberStrings: false,
    // Un UPDATE riporta le righe *trovate*, non solo quelle cambiate: come SQLite.
    flags: ["FOUND_ROWS"],
    ...(wantsTls ? { ssl: opts.sslCa ? { ca: opts.sslCa } : {} } : {}),
  });
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    await pool.end().catch(() => {});
    throw err;
  }
  return new MysqlDriver(pool);
}
