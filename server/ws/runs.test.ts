import { describe, it, expect } from 'vitest';
import { admitRun, findStaleThreads, REAPER_SILENCE_CAP_MS, REAPER_TOTAL_CAP_MS } from './runs';

describe('findStaleThreads', () => {
  const now = 1_000_000_000;

  it('mata turno mudo além do teto de silêncio', () => {
    const entries: [string, { startedAt: number; lastFrameAt?: number }][] = [
      ['a', { startedAt: now - 60_000, lastFrameAt: now - REAPER_SILENCE_CAP_MS - 1 }],
    ];
    expect(findStaleThreads(now, entries)).toEqual(['a']);
  });

  it('preserva turno com frame recente', () => {
    const entries: [string, { startedAt: number; lastFrameAt?: number }][] = [
      ['a', { startedAt: now - REAPER_SILENCE_CAP_MS - 1, lastFrameAt: now - 1000 }],
    ];
    expect(findStaleThreads(now, entries)).toEqual([]);
  });

  it('mata turno vivo além do teto total mesmo com frames chegando', () => {
    const entries: [string, { startedAt: number; lastFrameAt?: number }][] = [
      ['a', { startedAt: now - REAPER_TOTAL_CAP_MS - 1, lastFrameAt: now - 500 }],
    ];
    expect(findStaleThreads(now, entries)).toEqual(['a']);
  });

  it('turno sem frame algum conta silêncio desde o início', () => {
    const entries: [string, { startedAt: number; lastFrameAt?: number }][] = [
      ['fresh', { startedAt: now - 1000 }],
      ['old', { startedAt: now - REAPER_SILENCE_CAP_MS - 1 }],
    ];
    expect(findStaleThreads(now, entries)).toEqual(['old']);
  });
});

describe('admitRun', () => {
  it('admits while live runs are below the cap', () => {
    expect(admitRun(0, false, 3)).toBe(true);
    expect(admitRun(2, false, 3)).toBe(true);
  });

  it('rejects a brand-new run once the cap is reached', () => {
    expect(admitRun(3, false, 3)).toBe(false);
    expect(admitRun(5, false, 3)).toBe(false);
  });

  it('always admits a run that replaces an existing key, even at the cap', () => {
    expect(admitRun(3, true, 3)).toBe(true);
    expect(admitRun(99, true, 3)).toBe(true);
  });
});
