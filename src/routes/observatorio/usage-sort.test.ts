import { describe, it, expect } from 'vitest';
import { sortUsage } from './usage-sort';
import type { SessionUsage } from '../../../shared/protocol';

const row = (id: string, costUsd: number, outputTokens: number, lastTs: number): SessionUsage => ({
  sessionId: id, ctxTokens: 0, outputTokens, samples: 0, lastTs, model: null, costUsd,
});

const rows = [
  row('a', 3, 100, 30),
  row('b', 1, 300, 10),
  row('c', 2, 200, 20),
];

describe('sortUsage', () => {
  it('ordena por custo desc/asc', () => {
    expect(sortUsage(rows, 'cost', 'desc').map((r) => r.sessionId)).toEqual(['a', 'c', 'b']);
    expect(sortUsage(rows, 'cost', 'asc').map((r) => r.sessionId)).toEqual(['b', 'c', 'a']);
  });

  it('ordena por saída', () => {
    expect(sortUsage(rows, 'output', 'desc').map((r) => r.sessionId)).toEqual(['b', 'c', 'a']);
  });

  it('ordena por visto (lastTs)', () => {
    expect(sortUsage(rows, 'seen', 'desc').map((r) => r.sessionId)).toEqual(['a', 'c', 'b']);
  });

  it('não muta o array original', () => {
    const before = rows.map((r) => r.sessionId);
    sortUsage(rows, 'cost', 'asc');
    expect(rows.map((r) => r.sessionId)).toEqual(before);
  });
});
