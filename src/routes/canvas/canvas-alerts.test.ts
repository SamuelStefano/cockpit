import { describe, it, expect } from 'vitest';
import type { CanvasNode, TermStats } from '../../../shared/canvas';
import { alertLabel, countHotContext, countWaiting, sessionAlert } from './canvas-alerts';

const stats = (contextTokens: number, model = 'claude-sonnet-4-20250101'): TermStats => ({ cpu: 0, rssMb: 0, procs: 1, contextTokens, model });

describe('sessionAlert', () => {
  it('waiting wins even with a hot context', () => {
    expect(sessionAlert(true, stats(190_000))).toBe('waiting');
  });

  it('flags context at or above 80%', () => {
    expect(sessionAlert(false, stats(160_000))).toBe('context'); // 80% of 200k
    expect(sessionAlert(false, stats(158_000))).toBeNull(); // 79%, rounds down
  });

  it('nothing without waiting or stats', () => {
    expect(sessionAlert(false)).toBeNull();
    expect(sessionAlert(false, stats(1000))).toBeNull();
  });
});

describe('alertLabel', () => {
  it('labels each kind and returns empty for none', () => {
    expect(alertLabel('waiting', null)).toBe('esperando você');
    expect(alertLabel('context', 83)).toBe('contexto 83%');
    expect(alertLabel(null, null)).toBe('');
  });
});

const node = (over: Partial<CanvasNode>): CanvasNode => ({ id: 's:a', kind: 'session', ref: 'a', title: 't', subtitle: '', mtime: 0, ...over });

describe('counts', () => {
  const nodes: CanvasNode[] = [
    node({ id: 's:a', ref: 'a' }),
    node({ id: 's:b', ref: 'b' }),
    node({ id: 'c:x', ref: 'x', kind: 'context' }),
  ];

  it('counts only session nodes present in the waiting set', () => {
    expect(countWaiting(nodes, new Set(['a']))).toBe(1);
    expect(countWaiting(nodes, new Set(['x']))).toBe(0);
  });

  it('counts only session nodes with a hot context in the stats map', () => {
    expect(countHotContext(nodes, { a: stats(180_000), x: stats(180_000) })).toBe(1);
    expect(countHotContext(nodes, {})).toBe(0);
  });
});
