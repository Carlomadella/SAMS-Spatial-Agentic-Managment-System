import { describe, expect, it } from "vitest";
import { Mutex, openSqlite, splitStatements } from "./sql";

describe("Mutex", () => {
  it("esegue le sezioni una alla volta, in ordine d'arrivo", async () => {
    const lock = new Mutex();
    const log: string[] = [];
    const tick = () => new Promise((r) => setTimeout(r, 5));
    await Promise.all(
      ["a", "b", "c"].map((name) =>
        lock.run(async () => {
          log.push(`${name}:in`);
          await tick();
          log.push(`${name}:out`);
        }),
      ),
    );
    expect(log).toEqual(["a:in", "a:out", "b:in", "b:out", "c:in", "c:out"]);
  });

  it("una sezione che lancia non blocca le successive", async () => {
    const lock = new Mutex();
    await expect(lock.run(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    await expect(lock.run(async () => 42)).resolves.toBe(42);
  });
});

describe("splitStatements", () => {
  it("divide sui punto e virgola e scarta commenti e vuoti", () => {
    const sql = `
      -- commento
      CREATE TABLE a (x INT);
      CREATE TABLE b (y INT); ;
    `;
    expect(splitStatements(sql)).toEqual(["CREATE TABLE a (x INT)", "CREATE TABLE b (y INT)"]);
  });
});

describe("driver SQLite", () => {
  it("all / get / run con parametri", async () => {
    const db = openSqlite(":memory:");
    await db.exec("CREATE TABLE t (k TEXT PRIMARY KEY, v INTEGER)");
    expect((await db.run("INSERT INTO t (k, v) VALUES (?, ?)", ["a", 1])).changes).toBe(1);
    await db.run("INSERT INTO t (k, v) VALUES (?, ?)", ["b", 2]);
    expect(await db.get("SELECT v FROM t WHERE k = ?", ["b"])).toEqual({ v: 2 });
    expect(await db.get("SELECT v FROM t WHERE k = ?", ["zz"])).toBeUndefined();
    expect((await db.all("SELECT k FROM t ORDER BY k")).map((r) => r.k)).toEqual(["a", "b"]);
    await db.close();
  });

  it("la transazione fa commit se va a buon fine e rollback se lancia", async () => {
    const db = openSqlite(":memory:");
    await db.exec("CREATE TABLE t (v INTEGER)");
    await db.transaction(async (tx) => {
      await tx.run("INSERT INTO t (v) VALUES (1)");
    });
    await expect(
      db.transaction(async (tx) => {
        await tx.run("INSERT INTO t (v) VALUES (2)");
        throw new Error("a metà");
      }),
    ).rejects.toThrow("a metà");
    expect((await db.all("SELECT v FROM t")).map((r) => r.v)).toEqual([1]);
    await db.close();
  });

  // Con una sola connessione, una query di un'altra richiesta che si infilasse tra due
  // `await` della transazione finirebbe dentro di essa (e nel suo eventuale rollback).
  it("una query esterna aspetta la fine della transazione in corso", async () => {
    const db = openSqlite(":memory:");
    await db.exec("CREATE TABLE t (v INTEGER)");
    const order: string[] = [];
    const tx = db.transaction(async (t) => {
      await t.run("INSERT INTO t (v) VALUES (1)");
      await new Promise((r) => setTimeout(r, 10));
      order.push("tx-fine");
      throw new Error("rollback");
    });
    const outside = db.run("INSERT INTO t (v) VALUES (99)").then(() => order.push("esterna"));
    await expect(tx).rejects.toThrow("rollback");
    await outside;
    expect(order).toEqual(["tx-fine", "esterna"]);
    // La riga esterna è sopravvissuta al rollback della transazione.
    expect((await db.all("SELECT v FROM t")).map((r) => r.v)).toEqual([99]);
    await db.close();
  });
});
