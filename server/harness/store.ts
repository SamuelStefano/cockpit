import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { CONFIG } from '../config';
import type { HarnessContext, HarnessMode, HarnessTaskView, HarnessTier, HarnessVia } from '../../shared/protocol';

// Storage próprio do harness — mesma convenção self-migrating de db.ts, mesmo
// arquivo (WAL suporta múltiplas conexões), tabela isolada. Nunca importa ws/runs.ts
// (ver isolamento no design).

let db: Database.Database | null = null;

function open(): Database.Database {
  if (db) return db;
  mkdirSync(dirname(CONFIG.dbPath), { recursive: true });
  db = new Database(CONFIG.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS harness_task (
      id            TEXT PRIMARY KEY,
      ts            INTEGER NOT NULL,
      prompt        TEXT NOT NULL,
      context       TEXT,
      mode          TEXT NOT NULL,
      via           TEXT,
      tier          TEXT NOT NULL,
      tier_reason   TEXT NOT NULL,
      model         TEXT NOT NULL,
      status        TEXT NOT NULL,
      result_text   TEXT,
      cost_usd      REAL,
      input_tokens  INTEGER,
      output_tokens INTEGER,
      duration_ms   INTEGER,
      error         TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_harness_task_ts ON harness_task(ts);
  `);
  return db;
}

interface Row {
  id: string; ts: number; prompt: string; context: HarnessContext; mode: HarnessMode; via: HarnessVia | null;
  tier: HarnessTier; tier_reason: string; model: string; status: HarnessTaskView['status'];
  result_text: string | null; cost_usd: number | null; input_tokens: number | null;
  output_tokens: number | null; duration_ms: number | null; error: string | null;
}

function fromRow(r: Row): HarnessTaskView {
  return {
    id: r.id, ts: r.ts, prompt: r.prompt, context: r.context, mode: r.mode, via: r.via ?? undefined, tier: r.tier,
    tierReason: r.tier_reason, model: r.model, status: r.status,
    resultText: r.result_text ?? undefined, costUsd: r.cost_usd ?? undefined,
    inputTokens: r.input_tokens ?? undefined, outputTokens: r.output_tokens ?? undefined,
    durationMs: r.duration_ms ?? undefined, error: r.error ?? undefined,
  };
}

export function insertTask(t: HarnessTaskView): void {
  open().prepare(`INSERT INTO harness_task
      (id, ts, prompt, context, mode, via, tier, tier_reason, model, status, result_text, cost_usd, input_tokens, output_tokens, duration_ms, error)
      VALUES (@id, @ts, @prompt, @context, @mode, @via, @tier, @tierReason, @model, @status, @resultText, @costUsd, @inputTokens, @outputTokens, @durationMs, @error)`)
    .run({
      id: t.id, ts: t.ts, prompt: t.prompt, context: t.context, mode: t.mode, via: t.via ?? null, tier: t.tier, tierReason: t.tierReason,
      model: t.model, status: t.status, resultText: t.resultText ?? null,
      costUsd: t.costUsd ?? null, inputTokens: t.inputTokens ?? null,
      outputTokens: t.outputTokens ?? null, durationMs: t.durationMs ?? null, error: t.error ?? null,
    });
}

// Fecha a task: tier/model só são conhecidos DEPOIS da classificação/resolução, então
// migram junto do resultado (a linha 'running' nasce com placeholders).
export function finishTask(id: string, patch: Partial<HarnessTaskView>): void {
  open().prepare(`UPDATE harness_task SET
      via = @via, tier = @tier, tier_reason = @tierReason, model = @model,
      status = @status, result_text = @resultText, cost_usd = @costUsd,
      input_tokens = @inputTokens, output_tokens = @outputTokens, duration_ms = @durationMs, error = @error
      WHERE id = @id`)
    .run({
      id,
      via: patch.via ?? null,
      tier: patch.tier ?? 'medium', tierReason: patch.tierReason ?? '', model: patch.model ?? '',
      status: patch.status ?? 'error',
      resultText: patch.resultText ?? null, costUsd: patch.costUsd ?? null,
      inputTokens: patch.inputTokens ?? null, outputTokens: patch.outputTokens ?? null,
      durationMs: patch.durationMs ?? null, error: patch.error ?? null,
    });
}

const LIST_LIMIT = 100;

export function listTasks(): HarnessTaskView[] {
  const rows = open().prepare('SELECT * FROM harness_task ORDER BY ts DESC LIMIT ?').all(LIST_LIMIT) as Row[];
  return rows.map(fromRow);
}
