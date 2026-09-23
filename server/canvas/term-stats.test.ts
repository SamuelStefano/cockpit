import { describe, expect, it } from 'vitest';
import { cpuPercent, lastUsage, parseProcStat, treeOf } from './term-stats';

describe('parseProcStat', () => {
  it('counts fields from the last paren so a spaced command name parses', () => {
    const raw = '42 (tmux: server) S 7 42 42 0 -1 4194560 100 0 0 0 150 50 0 0 20 0 1 0 1000 9000000 256 18446744073709551615';
    expect(parseProcStat(raw)).toEqual({ pid: 42, ppid: 7, ticks: 200, rssKb: 1024 });
  });

  it('rejects garbage', () => {
    expect(parseProcStat('nonsense')).toBeNull();
  });
});

describe('treeOf', () => {
  const rows = [
    { pid: 1, ppid: 0, ticks: 1, rssKb: 1 },
    { pid: 10, ppid: 1, ticks: 5, rssKb: 100 },
    { pid: 11, ppid: 10, ticks: 7, rssKb: 200 },
    { pid: 12, ppid: 11, ticks: 3, rssKb: 50 },
    { pid: 20, ppid: 1, ticks: 9, rssKb: 999 },
  ];
  it('walks every descendant of the roots and nothing else', () => {
    expect(treeOf([10], rows).map((r) => r.pid).sort()).toEqual([10, 11, 12]);
  });
  it('ignores roots that are gone', () => {
    expect(treeOf([99], rows)).toEqual([]);
  });
});

describe('cpuPercent', () => {
  it('is ticks over wall time, in % of one core', () => {
    expect(cpuPercent({ ticks: 100, at: 0 }, 150, 1000)).toBe(50);
  });
  it('reads 0 on the first sample and when the tree shrank', () => {
    expect(cpuPercent(undefined, 150, 1000)).toBe(0);
    expect(cpuPercent({ ticks: 500, at: 0 }, 150, 1000)).toBe(0);
  });
});

describe('lastUsage', () => {
  it('takes the newest assistant usage as the context size', () => {
    const tail = [
      '{"type":"assistant","timestamp":"2026-09-23T10:00:00Z","message":{"model":"claude-opus-5-5","usage":{"input_tokens":10,"cache_read_input_tokens":1000,"cache_creation_input_tokens":90}}}',
      '{"type":"user","timestamp":"2026-09-23T10:01:00Z","message":{"content":"x"}}',
      '{"broken',
    ].join('\n');
    expect(lastUsage(tail)).toEqual({ contextTokens: 1100, model: 'claude-opus-5-5', lastAt: Date.parse('2026-09-23T10:01:00Z') });
  });

  it('is empty for a transcript with no turn yet', () => {
    expect(lastUsage('')).toEqual({});
  });
});
