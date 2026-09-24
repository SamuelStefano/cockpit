import { describe, it, expect } from 'vitest';
import type { CanvasNode, TermStats } from '../../../shared/canvas';
import type { SessionKanbanItem } from './kanban-items';
import { alertLabel, countHotContext, countWaiting, sessionAlert, summarizeStatus } from './canvas-alerts';

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

const NOW = 1_700_000_000_000;
const item = (over: Partial<SessionKanbanItem>): SessionKanbanItem => ({
  nodeId: 's:a', sessionId: 'a', title: 'sessão a', subtitle: '', orchestratorChild: false,
  status: 'doing', running: false, waitingOnUser: false, needsAttention: false, mtime: NOW, ...over,
});

describe('summarizeStatus', () => {
  it('puts one item per bucket and remembers the first match', () => {
    const items = [
      item({ nodeId: 's:run', running: true }),
      item({ nodeId: 's:wait', waitingOnUser: true }),
      item({ nodeId: 's:err', needsAttention: true }),
      item({ nodeId: 's:done', status: 'review', mtime: NOW - 60_000 }),
    ];
    const s = summarizeStatus(items, NOW);
    expect(s.running).toEqual({ count: 1, firstNodeId: 's:run' });
    expect(s.waiting).toEqual({ count: 1, firstNodeId: 's:wait' });
    expect(s.errored).toEqual({ count: 1, firstNodeId: 's:err' });
    expect(s.doneRecent).toEqual({ count: 1, firstNodeId: 's:done' });
  });

  it('running outranks a session also flagged waiting or needing attention', () => {
    const s = summarizeStatus([item({ running: true, waitingOnUser: true, needsAttention: true })], NOW);
    expect(s.running.count).toBe(1);
    expect(s.waiting.count).toBe(0);
    expect(s.errored.count).toBe(0);
  });

  it('a "done" past the 24h window counts nowhere', () => {
    const s = summarizeStatus([item({ status: 'review', mtime: NOW - 25 * 3600_000 })], NOW);
    expect(s.doneRecent.count).toBe(0);
  });

  it('drops cron reset-pings even though they are otherwise unattended-done', () => {
    const s = summarizeStatus([item({ title: '.', subtitle: '', status: 'review' })], NOW);
    expect(s.doneRecent.count).toBe(0);
  });

  it('keeps the FIRST match per bucket, not the last', () => {
    const s = summarizeStatus([item({ nodeId: 's:first', running: true }), item({ nodeId: 's:second', running: true })], NOW);
    expect(s.running).toEqual({ count: 2, firstNodeId: 's:first' });
  });

  it('empty input summarizes to all-zero, no crash', () => {
    const s = summarizeStatus([], NOW);
    expect(s).toEqual({ running: { count: 0 }, waiting: { count: 0 }, errored: { count: 0 }, doneRecent: { count: 0 } });
  });
});
