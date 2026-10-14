/**
 * Base D1 de test : même interface que le binding Cloudflare, exécutée sur le SQLite intégré
 * à Node (node:sqlite), avec les vraies migrations du dossier migrations/.
 * Une latence aléatoire avant chaque requête permet d'entrelacer des requêtes concurrentes,
 * comme en production où chaque instruction D1 est atomique mais les requêtes s'intercalent.
 * Uniquement pour les tests — aucun accès réseau ni à Cloudflare.
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { D1Database, D1PreparedStatement, D1Result } from "../d1";

const MIGRATIONS_DIR = new URL("../../migrations/", import.meta.url);

export interface SqliteD1Options {
  jitterMs?: number;
  /** Appelé avant chaque requête SQL (permet d'injecter une écriture concurrente). */
  beforeQuery?: (sql: string) => void | Promise<void>;
}

export class SqliteD1 implements D1Database {
  readonly sqlite = new DatabaseSync(":memory:");
  readonly log: string[] = [];

  constructor(private opts: SqliteD1Options = {}) {
    for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
      this.sqlite.exec(readFileSync(new URL(file, MIGRATIONS_DIR), "utf8"));
    }
  }

  private async pause(sql: string) {
    await this.opts.beforeQuery?.(sql);
    if (this.opts.jitterMs) await new Promise((r) => setTimeout(r, Math.random() * this.opts.jitterMs!));
  }

  prepare(sql: string): D1PreparedStatement {
    const db = this;
    const make = (values: unknown[]): D1PreparedStatement => ({
      bind: (...next: unknown[]) => make(next),
      async first<T>() {
        await db.pause(sql);
        db.log.push(sql);
        return (db.sqlite.prepare(sql).get(...(values as SQLInputValue[])) as T | undefined) ?? null;
      },
      async all<T>() {
        await db.pause(sql);
        db.log.push(sql);
        return { results: db.sqlite.prepare(sql).all(...(values as SQLInputValue[])) as T[], meta: { changes: 0 } } as D1Result<T>;
      },
      async run() {
        await db.pause(sql);
        db.log.push(sql);
        const r = db.sqlite.prepare(sql).run(...(values as SQLInputValue[]));
        return { results: [], meta: { changes: Number(r.changes) } };
      },
    });
    return make([]);
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    const out: D1Result[] = [];
    for (const s of statements) out.push(await s.run());
    return out;
  }

  /** Lecture directe pour les assertions des tests. */
  row<T>(sql: string, ...values: SQLInputValue[]): T | undefined {
    return this.sqlite.prepare(sql).get(...values) as T | undefined;
  }

  rows<T>(sql: string, ...values: SQLInputValue[]): T[] {
    return this.sqlite.prepare(sql).all(...values) as T[];
  }
}
