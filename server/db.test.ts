import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { priceOf, costOf } from './db';
import { midnightInTz } from '../shared/cron-schedule';

describe('priceOf', () => {
  it('matches each tier by substring of the model name', () => {
    expect(priceOf('claude-opus-4').input).toBe(15);
    expect(priceOf('claude-3-5-haiku').input).toBe(0.8);
    expect(priceOf('claude-sonnet-4').input).toBe(3);
  });

  it('is case-insensitive', () => {
    expect(priceOf('CLAUDE-OPUS-4').output).toBe(75);
  });

  it('falls back to sonnet for null or unknown models', () => {
    expect(priceOf(null)).toEqual(priceOf('claude-sonnet-4'));
    expect(priceOf('gpt-4o')).toEqual(priceOf('claude-sonnet-4'));
  });

  // fable está no seletor do harness (policy.ts) como tier 'complex', igual ao
  // opus. Sem entrada própria caía no default sonnet e a chamada paga aparecia
  // por ~1/5 do custo.
  it('prices every model the harness offers by its declared tier', async () => {
    const { NATIVE_MODELS } = await import('./harness/policy');
    const byTier = { simple: 0.8, medium: 3, complex: 15 };
    for (const m of NATIVE_MODELS) {
      expect(priceOf(m.id).input, m.id).toBe(byTier[m.tier]);
    }
  });
});

describe('costOf', () => {
  const empty = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };

  it('prices 1M input opus tokens at $15', () => {
    expect(costOf('claude-opus-4', { ...empty, input: 1_000_000 })).toBe(15);
  });

  it('prices the cheap cache-read leg separately (1M opus = $1.50)', () => {
    expect(costOf('claude-opus-4', { ...empty, cacheRead: 1_000_000 })).toBeCloseTo(1.5, 10);
  });

  it('sums all four legs', () => {
    const cost = costOf('claude-opus-4', {
      input: 1_000_000,
      output: 1_000_000,
      cacheRead: 1_000_000,
      cacheCreation: 1_000_000,
    });
    expect(cost).toBeCloseTo(15 + 75 + 1.5 + 18.75, 10);
  });

  it('returns zero for no tokens', () => {
    expect(costOf('claude-opus-4', empty)).toBe(0);
  });
});

describe('computeStats per-model pricing', () => {
  const dirs: string[] = [];
  async function freshDb() {
    const dir = mkdtempSync(join(tmpdir(), 'cockpit-db-'));
    dirs.push(dir);
    process.env.COCKPIT_DB = join(dir, 'usage.db');
    vi.resetModules();
    return import('./db');
  }
  afterEach(() => {
    delete process.env.COCKPIT_DB;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('sweepUsage prunes stale last-turn outcomes too', async () => {
    const db = await freshDb();
    db.setTurnOutcome('old', true, Date.now() - 200 * 86_400_000);
    db.setTurnOutcome('new', true, Date.now());
    db.sweepUsage();
    expect(db.getTurnOutcome('old')).toBeNull();
    expect(db.getTurnOutcome('new')).toBe(true);
  });

  it('prices each turn at its own model, not the latest one', async () => {
    const { recordUsage, usageStats, costOf: cost } = await freshDb();
    recordUsage({ sessionId: 's1', ctxTokens: 1000, outputTokens: 1_000_000, model: 'claude-opus-4' });
    recordUsage({ sessionId: 's1', ctxTokens: 1000, outputTokens: 1_000_000, model: 'claude-3-5-haiku' });
    const stats = usageStats();
    const s1 = stats.sessions.find((s) => s.sessionId === 's1')!;
    const expected = cost('claude-opus-4', { input: 0, output: 1_000_000, cacheRead: 0, cacheCreation: 0 })
      + cost('claude-3-5-haiku', { input: 0, output: 1_000_000, cacheRead: 0, cacheCreation: 0 });
    expect(s1.costUsd).toBeCloseTo(expected, 8);
    expect(s1.model).toBe('claude-3-5-haiku');
    expect(s1.outputTokens).toBe(2_000_000);
    expect(s1.samples).toBe(2);
  });

});

describe('usageStats daily series', () => {
  const dirs: string[] = [];
  async function freshDb() {
    const dir = mkdtempSync(join(tmpdir(), 'cockpit-series-'));
    dirs.push(dir);
    process.env.COCKPIT_DB = join(dir, 'usage.db');
    vi.resetModules();
    return import('./db');
  }
  afterEach(() => {
    delete process.env.COCKPIT_DB;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  // Os buckets são dias de Brasília: a fixture usa meio-dia BRT pra não escorregar
  // de dia quando a suite roda de madrugada UTC.
  const dayKey = (offsetDays: number) => midnightInTz(Date.now()) - offsetDays * 86_400_000;
  const dayStart = (offsetDays: number) => dayKey(offsetDays) + 12 * 3_600_000;
  const insert = (path: string, row: { ts: number; output: number; model: string }) => {
    const raw = new Database(path);
    raw.prepare(`INSERT INTO usage_sample
      (session_id, ts, ctx_tokens, output_tokens, input_tokens, cache_read_tokens, cache_creation_tokens, model)
      VALUES ('sx', ?, 0, ?, 0, 0, 0, ?)`).run(row.ts, row.output, row.model);
    raw.close();
  };

  it('buckets cost by local day and prices each row at its own model', async () => {
    const { usageStats, recordUsage } = await freshDb();
    recordUsage({ sessionId: 'init', ctxTokens: 1, outputTokens: 1, model: 'claude-opus-4' });
    const path = process.env.COCKPIT_DB!;
    const today = dayStart(0);
    const yesterday = dayStart(1);
    insert(path, { ts: today + 1000, output: 1_000_000, model: 'claude-opus-4' });
    insert(path, { ts: today + 2000, output: 1_000_000, model: 'claude-3-5-haiku' });
    insert(path, { ts: yesterday + 1000, output: 1_000_000, model: 'claude-sonnet-4' });

    const series = usageStats().series;
    const byDay = new Map(series.map((b) => [b.day, b]));

    const todayBucket = byDay.get(dayKey(0))!;
    expect(todayBucket.output).toBeGreaterThanOrEqual(2_000_000);
    const todayModelCost = costOf('claude-opus-4', { input: 0, output: 1_000_000, cacheRead: 0, cacheCreation: 0 })
      + costOf('claude-3-5-haiku', { input: 0, output: 1_000_000, cacheRead: 0, cacheCreation: 0 });
    expect(todayBucket.cost).toBeGreaterThan(todayModelCost - 0.01);

    const yBucket = byDay.get(dayKey(1))!;
    expect(yBucket.output).toBe(1_000_000);
    expect(yBucket.cost).toBeCloseTo(15, 6);
  });

  it('sorts buckets ascending by day', async () => {
    const { usageStats } = await freshDb();
    const { recordUsage } = await import('./db');
    recordUsage({ sessionId: 'init', ctxTokens: 1, outputTokens: 1, model: 'claude-sonnet-4' });
    const path = process.env.COCKPIT_DB!;
    insert(path, { ts: dayStart(1) + 1000, output: 1000, model: 'claude-sonnet-4' });
    insert(path, { ts: dayStart(3) + 1000, output: 1000, model: 'claude-sonnet-4' });
    const series = usageStats().series;
    const days = series.map((b) => b.day);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });
});

describe('session_turn_outcome', () => {
  const dirs: string[] = [];
  async function freshDb() {
    const dir = mkdtempSync(join(tmpdir(), 'cockpit-db-'));
    dirs.push(dir);
    process.env.COCKPIT_DB = join(dir, 'outcome.db');
    vi.resetModules();
    return import('./db');
  }
  afterEach(() => {
    delete process.env.COCKPIT_DB;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('round-trips ok=true and ok=false', async () => {
    const { setTurnOutcome, getTurnOutcome } = await freshDb();
    setTurnOutcome('s1', true, 100);
    setTurnOutcome('s2', false, 200);
    expect(getTurnOutcome('s1')).toBe(true);
    expect(getTurnOutcome('s2')).toBe(false);
  });

  it('an unknown session returns null, not false', async () => {
    const { getTurnOutcome } = await freshDb();
    expect(getTurnOutcome('never-seen')).toBeNull();
  });

  it('a second write replaces the first (upsert, not history)', async () => {
    const { setTurnOutcome, getTurnOutcome } = await freshDb();
    setTurnOutcome('s1', true, 100);
    setTurnOutcome('s1', false, 200);
    expect(getTurnOutcome('s1')).toBe(false);
  });

  it('allTurnOutcomes decorates every row in one map', async () => {
    const { setTurnOutcome, allTurnOutcomes } = await freshDb();
    setTurnOutcome('s1', true, 100);
    setTurnOutcome('s2', false, 200);
    const all = allTurnOutcomes();
    expect(all.get('s1')).toBe(true);
    expect(all.get('s2')).toBe(false);
    expect(all.has('s3')).toBe(false);
  });
});
