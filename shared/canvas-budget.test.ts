import { describe, it, expect } from 'vitest';
import type { AreaId, TermStats } from './canvas';
import { areaUsageFromIds, evaluateBudget } from './canvas-budget';

const stat = (extra: Partial<TermStats> = {}): TermStats => ({ cpu: 0, rssMb: 0, procs: 1, ...extra });
const areaMap = (entries: [string, AreaId][]) => new Map(entries);

describe('areaUsageFromIds', () => {
  it('sums cpu AND ctxTokens for every id in the one sessionIds set', () => {
    const areaOf = areaMap([['a', 'dfl'], ['b', 'dfl']]);
    const stats = { a: stat({ cpu: 30, contextTokens: 1000 }), b: stat({ cpu: 20, contextTokens: 2000 }) };
    const usage = areaUsageFromIds(areaOf, ['a', 'b'], stats);
    expect(usage.dfl).toEqual({ cpu: 50, ctxTokens: 3000 });
  });

  it('keeps areas separate', () => {
    const areaOf = areaMap([['a', 'dfl'], ['b', 'deck']]);
    const stats = { a: stat({ cpu: 10, contextTokens: 100 }), b: stat({ cpu: 5, contextTokens: 50 }) };
    const usage = areaUsageFromIds(areaOf, ['a', 'b'], stats);
    expect(usage).toEqual({ dfl: { cpu: 10, ctxTokens: 100 }, deck: { cpu: 5, ctxTokens: 50 } });
  });

  it('ignores an id with no known area or no stats', () => {
    const areaOf = areaMap([['b', 'dfl']]);
    expect(areaUsageFromIds(areaOf, [], { a: stat(), b: stat() })).toEqual({});
  });

  it('an id not in sessionIds is excluded even if it has stats and a known area', () => {
    const areaOf = areaMap([['a', 'dfl'], ['b', 'dfl']]);
    const usage = areaUsageFromIds(areaOf, ['a'], { a: stat({ cpu: 10 }), b: stat({ cpu: 999 }) });
    expect(usage.dfl?.cpu).toBe(10);
  });

  it('never double-counts an id repeated by a sloppy caller', () => {
    const areaOf = areaMap([['a', 'dfl']]);
    const usage = areaUsageFromIds(areaOf, ['a', 'a', 'a'], { a: stat({ cpu: 10 }) });
    expect(usage.dfl?.cpu).toBe(10);
  });

  it('a session with no contextTokens field contributes cpu but 0 ctx', () => {
    const areaOf = areaMap([['a', 'dfl']]);
    const usage = areaUsageFromIds(areaOf, ['a'], { a: stat({ cpu: 10 }) });
    expect(usage.dfl).toEqual({ cpu: 10, ctxTokens: 0 });
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
