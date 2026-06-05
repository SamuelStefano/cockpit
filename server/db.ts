import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { CONFIG } from './config';
import type { SessionUsage, UsageStats } from '../shared/protocol';

// SQLite local, single-writer, loopback-only. WAL pra leitura concorrente com o
// loop de stats. Só time-series de uso por enquanto (one-way door: session_id
// estável + append-only travados; resto difere — DR persistência 2026-06-05).

let db: Database.Database | null = null;

function open(): Database.Database {
  if (db) return db;
  mkdirSync(dirname(CONFIG.dbPath), { recursive: true });
  db = new Database(CONFIG.dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_sample (
      id            INTEGER PRIMARY KEY,
      session_id    TEXT NOT NULL,
      ts            INTEGER NOT NULL,
      ctx_tokens    INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      model         TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_usage_session_ts ON usage_sample(session_id, ts);
  `);
  return db;
}

export interface UsageInput {
  sessionId: string;
  ctxTokens: number;
  outputTokens: number;
  model?: string;
}

export function recordUsage(u: UsageInput): void {
  if (!u.sessionId) return;
  if (u.ctxTokens <= 0 && u.outputTokens <= 0) return;
  open()
    .prepare('INSERT INTO usage_sample (session_id, ts, ctx_tokens, output_tokens, model) VALUES (?, ?, ?, ?, ?)')
    .run(u.sessionId, Date.now(), Math.round(u.ctxTokens), Math.round(u.outputTokens), u.model ?? null);
}

export function usageStats(): UsageStats {
  const rows = open().prepare(`
    SELECT
      session_id                       AS sessionId,
      COUNT(*)                         AS samples,
      SUM(output_tokens)               AS outputTokens,
      MAX(ts)                          AS lastTs
    FROM usage_sample
    GROUP BY session_id
    ORDER BY lastTs DESC
  `).all() as Array<{ sessionId: string; samples: number; outputTokens: number; lastTs: number }>;

  const latest = open().prepare(`
    SELECT ctx_tokens AS ctxTokens, model FROM usage_sample
    WHERE session_id = ? ORDER BY ts DESC LIMIT 1
  `);

  const sessions: SessionUsage[] = rows.map((r) => {
    const l = latest.get(r.sessionId) as { ctxTokens: number; model: string | null } | undefined;
    return {
      sessionId: r.sessionId,
      ctxTokens: l?.ctxTokens ?? 0,
      outputTokens: r.outputTokens ?? 0,
      samples: r.samples,
      lastTs: r.lastTs,
      model: l?.model ?? null,
    };
  });

  return {
    sessions,
    totalOutput: sessions.reduce((a, s) => a + s.outputTokens, 0),
    totalSamples: sessions.reduce((a, s) => a + s.samples, 0),
  };
}
