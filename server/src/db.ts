import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { MIGRATIONS } from './migrations.ts';

export type Db = DatabaseSync;

const TURKISH_LETTERS: Record<string, string> = { ı: 'i', ş: 's', ğ: 'g', ü: 'u', ö: 'o', ç: 'c' };

/**
 * Lowercase with Turkish rules, then Turkish letters to their plain forms, so a search for
 * "sahin" or "IŞIK" finds "Şahin" and "Işık". SQLite's own lower() and LIKE only fold ASCII.
 */
export function searchFold(text: string): string {
  return text.toLocaleLowerCase('tr-TR').replace(/[ışğüöç]/g, (char) => TURKISH_LETTERS[char] ?? char);
}

export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;');
  db.function('search_fold', { deterministic: true }, (value) => (typeof value === 'string' ? searchFold(value) : value));
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  const { user_version: current } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let version = current; version < MIGRATIONS.length; version++) {
    const sql = MIGRATIONS[version];
    if (!sql) throw new Error(`Missing migration ${version + 1}`);
    transaction(db, () => {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

/** Runs `fn` atomically. Not reentrant: do not call transaction() inside fn. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
