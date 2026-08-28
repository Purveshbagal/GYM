import Database from "better-sqlite3";
import { getQueuePath } from "./paths";

/**
 * Local durability layer so a temporary internet/backend outage never
 * loses data. Phase 2 only needs the schema + generic enqueue/dequeue —
 * later phases fill it with attendance events, enrollment results, and
 * device sync jobs generated while the backend is unreachable.
 */
export type QueuedItem = {
  id: number;
  kind: string;
  payload: string;
  attempts: number;
  createdAt: string;
};

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  db = new Database(getQueuePath());
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

export function enqueue(kind: string, payload: unknown): void {
  getDb()
    .prepare("INSERT INTO outbox (kind, payload, attempts, created_at) VALUES (?, ?, 0, ?)")
    .run(kind, JSON.stringify(payload), new Date().toISOString());
}

export function peekBatch(kind: string, limit = 20): QueuedItem[] {
  return getDb()
    .prepare("SELECT id, kind, payload, attempts, created_at as createdAt FROM outbox WHERE kind = ? ORDER BY id ASC LIMIT ?")
    .all(kind, limit) as QueuedItem[];
}

export function markSent(id: number): void {
  getDb().prepare("DELETE FROM outbox WHERE id = ?").run(id);
}

export function markAttempt(id: number): void {
  getDb().prepare("UPDATE outbox SET attempts = attempts + 1 WHERE id = ?").run(id);
}

export function pendingCount(): number {
  return (getDb().prepare("SELECT COUNT(*) as c FROM outbox").get() as { c: number }).c;
}

export function closeQueue(): void {
  db?.close();
  db = null;
}
