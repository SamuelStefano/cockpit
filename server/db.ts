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
  // Sem busy_timeout, qualquer SQLITE_BUSY (checkpoint, leitor externo) estoura
  // na hora — recordUsage engole, mas usageStats subiria um toast espúrio. 5s de
  // retry cobre a contenção real (escrita por evento + leituras do /uso).
  db.pragma('busy_timeout = 5000');
  // Checkpoint automático a cada ~1000 páginas (default, explícito): num processo
  // que fica dias de pé com escrita contínua, evita o -wal crescer sem limite.
  db.pragma('wal_autocheckpoint = 1000');
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
  // Componentes de cobrança (cache_read é ~10% do preço): adicionados depois,
  // por isso migram via ALTER idempotente.
  ensureColumn(db, 'usage_sample', 'input_tokens', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'usage_sample', 'cache_read_tokens', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'usage_sample', 'cache_creation_tokens', 'INTEGER NOT NULL DEFAULT 0');
  return db;
}

function ensureColumn(d: Database.Database, table: string, col: string, decl: string): void {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === col)) d.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
}

// Preço estimado por 1M tokens (USD). Aproxima a tabela pública da Anthropic;
// casado por substring do nome do modelo. É ESTIMATIVA — a UI rotula como tal.
interface Price { input: number; output: number; cacheWrite: number; cacheRead: number }
const PRICES: Record<string, Price> = {
  opus: { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  sonnet: { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  haiku: { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },
};
const DEFAULT_PRICE = PRICES.sonnet;

function priceOf(model: string | null): Price {
  const m = (model ?? '').toLowerCase();
  if (m.includes('opus')) return PRICES.opus;
  if (m.includes('haiku')) return PRICES.haiku;
  if (m.includes('sonnet')) return PRICES.sonnet;
  return DEFAULT_PRICE;
}

export interface UsageInput {
  sessionId: string;
  ctxTokens: number;
  outputTokens: number;
  inputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  model?: string;
}

export function recordUsage(u: UsageInput): void {
  if (!u.sessionId) return;
  if (u.ctxTokens <= 0 && u.outputTokens <= 0) return;
  // Best-effort: uma falha de disco/lock no SQLite nunca pode abortar a tradução
  // do evento NDJSON (o try/catch do line handler engoliria o throw e perderia o
  // capture() do snapshot). Métrica é secundária; o stream do chat é primário.
  try {
    open()
      .prepare(`INSERT INTO usage_sample
        (session_id, ts, ctx_tokens, output_tokens, input_tokens, cache_read_tokens, cache_creation_tokens, model)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        u.sessionId, Date.now(),
        Math.round(u.ctxTokens), Math.round(u.outputTokens),
        Math.round(u.inputTokens ?? 0), Math.round(u.cacheReadTokens ?? 0), Math.round(u.cacheCreationTokens ?? 0),
        u.model ?? null,
      );
  } catch {
    // disco cheio / DB lock — ignora; não derruba o turno
  }
}

const EMPTY_STATS: UsageStats = { sessions: [], totalOutput: 0, totalSamples: 0, totalCost: 0, series: [] };

// Força um checkpoint TRUNCATE: zera o -wal quando o auto-checkpoint é starved
// por um leitor de longa duração. Best-effort, chamado no sweep periódico.
export function checkpointWal(): void {
  try { open().pragma('wal_checkpoint(TRUNCATE)'); } catch { /* lock/disco — ignora */ }
}

// Retenção: descarta amostras de uso mais velhas que RETAIN_DAYS. O daily driver
// fica de pé por semanas e o loop de stats insere ~1 linha/5s por run; sem poda a
// tabela cresce indefinidamente. O trend do /uso só olha os últimos ~30 dias.
const RETAIN_DAYS = 90;
export function sweepUsage(): void {
  try {
    const cutoff = Date.now() - RETAIN_DAYS * 24 * 60 * 60 * 1000;
    open().prepare('DELETE FROM usage_sample WHERE ts < ?').run(cutoff);
  } catch { /* lock/disco — ignora, tenta no próximo sweep */ }
}

export function usageStats(): UsageStats {
  try {
    return computeStats();
  } catch {
    // lock transitório / disco — devolve vazio em vez de derrubar o handler num toast
    return EMPTY_STATS;
  }
}

function computeStats(): UsageStats {
  const rows = open().prepare(`
    SELECT
      session_id                       AS sessionId,
      COUNT(*)                         AS samples,
      SUM(output_tokens)               AS outputTokens,
      SUM(input_tokens)                AS inputTokens,
      SUM(cache_read_tokens)           AS cacheReadTokens,
      SUM(cache_creation_tokens)       AS cacheCreationTokens,
      MAX(ts)                          AS lastTs
    FROM usage_sample
    GROUP BY session_id
    ORDER BY lastTs DESC
  `).all() as Array<{
    sessionId: string; samples: number; outputTokens: number;
    inputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; lastTs: number;
  }>;

  const latest = open().prepare(`
    SELECT ctx_tokens AS ctxTokens, model FROM usage_sample
    WHERE session_id = ? ORDER BY ts DESC LIMIT 1
  `);

  const sessions: SessionUsage[] = rows.map((r) => {
    const l = latest.get(r.sessionId) as { ctxTokens: number; model: string | null } | undefined;
    const p = priceOf(l?.model ?? null);
    const costUsd = (
      (r.inputTokens ?? 0) * p.input +
      (r.cacheCreationTokens ?? 0) * p.cacheWrite +
      (r.cacheReadTokens ?? 0) * p.cacheRead +
      (r.outputTokens ?? 0) * p.output
    ) / 1_000_000;
    return {
      sessionId: r.sessionId,
      ctxTokens: l?.ctxTokens ?? 0,
      outputTokens: r.outputTokens ?? 0,
      samples: r.samples,
      lastTs: r.lastTs,
      model: l?.model ?? null,
      costUsd,
    };
  });

  return {
    sessions,
    totalOutput: sessions.reduce((a, s) => a + s.outputTokens, 0),
    totalSamples: sessions.reduce((a, s) => a + s.samples, 0),
    totalCost: sessions.reduce((a, s) => a + s.costUsd, 0),
    series: dailySeries(14),
  };
}

// Buckets diários (output + custo estimado) dos últimos N dias, pra trend no /uso.
function dailySeries(days: number): { day: number; output: number; cost: number }[] {
  const cutoff = Date.now() - days * 86_400_000;
  const rows = open().prepare(`
    SELECT ts, output_tokens AS output, input_tokens AS input,
           cache_read_tokens AS cacheRead, cache_creation_tokens AS cacheCreation, model
    FROM usage_sample WHERE ts >= ?
  `).all(cutoff) as Array<{ ts: number; output: number; input: number; cacheRead: number; cacheCreation: number; model: string | null }>;

  const buckets = new Map<number, { day: number; output: number; cost: number }>();
  for (const r of rows) {
    const d = new Date(r.ts); d.setHours(0, 0, 0, 0);
    const day = d.getTime();
    const p = priceOf(r.model);
    const cost = (r.input * p.input + r.cacheCreation * p.cacheWrite + r.cacheRead * p.cacheRead + r.output * p.output) / 1_000_000;
    const b = buckets.get(day) ?? { day, output: 0, cost: 0 };
    b.output += r.output; b.cost += cost;
    buckets.set(day, b);
  }
  return [...buckets.values()].sort((a, b) => a.day - b.day);
}
