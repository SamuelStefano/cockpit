import { describe, it, expect } from 'vitest';
import type { AreaId, TermStats } from './canvas';
import { areaUsageFromIds, evaluateBudget } from './canvas-budget';

const stat = (extra: Partial<TermStats> = {}): TermStats => ({ cpu: 0, rssMb: 0, procs: 1, ...extra });
const areaMap = (entries: [string, AreaId][]) => new Map(entries);

describe('areaUsageFromIds', () => {
  it('sums cpu only for the cpuIds set and ctxTokens only for the runningIds set', () => {
    const areaOf = areaMap([['a', 'dfl'], ['b', 'dfl']]);
    const stats = { a: stat({ cpu: 30, contextTokens: 1000 }), b: stat({ cpu: 20, contextTokens: 2000 }) };
    // 'a' is in cpuIds but not runningIds; 'b' is the reverse.
    const usage = areaUsageFromIds(areaOf, ['a'], new Set(['b']), stats);
    expect(usage.dfl).toEqual({ cpu: 30, ctxTokens: 2000 });
  });

  it('keeps areas separate', () => {
    const areaOf = areaMap([['a', 'dfl'], ['b', 'deck']]);
    const stats = { a: stat({ cpu: 10, contextTokens: 100 }), b: stat({ cpu: 5, contextTokens: 50 }) };
    const usage = areaUsageFromIds(areaOf, ['a', 'b'], new Set(['a', 'b']), stats);
    expect(usage).toEqual({ dfl: { cpu: 10, ctxTokens: 100 }, deck: { cpu: 5, ctxTokens: 50 } });
  });

  it('ignores an id with no known area, no stats, or nothing to count', () => {
    const areaOf = areaMap([['b', 'dfl']]);
    expect(areaUsageFromIds(areaOf, [], new Set(), { a: stat(), b: stat() })).toEqual({});
  });

  it('never double-counts a cpuIds entry repeated by a sloppy caller', () => {
    const areaOf = areaMap([['a', 'dfl']]);
    const usage = areaUsageFromIds(areaOf, ['a', 'a', 'a'], new Set(), { a: stat({ cpu: 10 }) });
    expect(usage.dfl?.cpu).toBe(10);
  });

  it('the SAME id set as both cpuIds and runningIds sums both metrics for it (the autopause-loop proxy)', () => {
    const areaOf = areaMap([['a', 'dfl']]);
    const ids = ['a'];
    const usage = areaUsageFromIds(areaOf, ids, new Set(ids), { a: stat({ cpu: 40, contextTokens: 5000 }) });
    expect(usage.dfl).toEqual({ cpu: 40, ctxTokens: 5000 });
  });
});

describe('evaluateBudget', () => {
  it('is not over anything with no budget set', () => {
    expect(evaluateBudget({ cpu: 999, ctxTokens: 999_999 }, undefined)).toEqual({ overCpu: false, overCtx: false, reasons: [] });
  });

  it('flags cpu and ctx independently, with a human reason each', () => {
    const status = evaluateBudget({ cpu: 120, ctxTokens: 50_000 }, { cpu: 100, ctxTokens: 200_000 });
    expect(status.overCpu).toBe(true);
    expect(status.overCtx).toBe(false);
    expect(status.reasons).toEqual(['cpu 120% > 100%']);
  });

  it('at the exact ceiling is not yet over (strictly greater)', () => {
    expect(evaluateBudget({ cpu: 100, ctxTokens: 0 }, { cpu: 100 }).overCpu).toBe(false);
  });

  it('no usage at all against a set budget is not over', () => {
    expect(evaluateBudget(undefined, { cpu: 10, ctxTokens: 10 })).toEqual({ overCpu: false, overCtx: false, reasons: [] });
  });
});
