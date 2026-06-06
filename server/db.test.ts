import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { priceOf, costOf } from './db';

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
