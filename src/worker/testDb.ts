// A D1 stand-in over node:sqlite for tests: same statements, same SQLite dialect.

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { D1, D1Result, D1Stmt } from './db.js';

class Stmt implements D1Stmt {
  constructor(private db: DatabaseSync, private sql: string, private values: unknown[] = []) {}
  bind(...values: unknown[]): D1Stmt { return new Stmt(this.db, this.sql, values); }
  private args() { return this.values.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v)) as never[]; }
  async first<T>(): Promise<T | null> { return (this.db.prepare(this.sql).get(...this.args()) as T | undefined) ?? null; }
  async all<T>(): Promise<D1Result<T>> { return { results: this.db.prepare(this.sql).all(...this.args()) as T[] }; }
  async run(): Promise<D1Result<unknown>> { const r = this.db.prepare(this.sql).run(...this.args()); return { results: [], meta: { changes: Number(r.changes) } }; }
}

export function testDb(): D1 {
  const db = new DatabaseSync(':memory:');
  db.exec(['0001_alpha.sql', '0002_screens.sql', '0003_intraday.sql', '0004_passwords.sql', '0005_unlocks.sql'].map((f) => readFileSync(new URL(`../../migrations/${f}`, import.meta.url), 'utf8')).join('\n'));
  return {
    prepare: (sql) => new Stmt(db, sql),
    // D1 runs a batch as one transaction.
    batch: async (stmts) => {
      db.exec('BEGIN');
      try { const out: D1Result<unknown>[] = []; for (const s of stmts) out.push(await s.run()); db.exec('COMMIT'); return out; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
