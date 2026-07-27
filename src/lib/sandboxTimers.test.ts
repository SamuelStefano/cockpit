// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTimerJail } from './sandboxTimers';

describe('createTimerJail', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('roda o timeout normalmente enquanto a build vive', () => {
    const jail = createTimerJail();
    const fn = vi.fn();
    (jail.scope.setTimeout as (f: () => void, ms: number) => number)(fn, 10);
    vi.advanceTimersByTime(20);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('mata o interval da build anterior no clear', () => {
    const jail = createTimerJail();
    const fn = vi.fn();
    (jail.scope.setInterval as (f: () => void, ms: number) => number)(fn, 10);
    vi.advanceTimersByTime(25);
    const before = fn.mock.calls.length;
    expect(before).toBeGreaterThan(0);
    jail.clear();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(before);
  });

  it('cancela timeout pendente no clear', () => {
    const jail = createTimerJail();
    const fn = vi.fn();
    (jail.scope.setTimeout as (f: () => void, ms: number) => number)(fn, 50);
    jail.clear();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it('isola builds: limpar uma não afeta a outra', () => {
    const a = createTimerJail();
    const b = createTimerJail();
    const fa = vi.fn();
    const fb = vi.fn();
    (a.scope.setTimeout as (f: () => void, ms: number) => number)(fa, 10);
    (b.scope.setTimeout as (f: () => void, ms: number) => number)(fb, 10);
    a.clear();
    vi.advanceTimersByTime(50);
    expect(fa).not.toHaveBeenCalled();
    expect(fb).toHaveBeenCalledTimes(1);
  });
});
