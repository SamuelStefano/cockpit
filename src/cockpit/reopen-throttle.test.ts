import { describe, it, expect, vi, afterEach } from 'vitest';
import { createReopenThrottle } from './reopen-throttle';

afterEach(() => vi.useRealTimers());

describe('createReopenThrottle', () => {
  it('fires once right away and once trailing for a burst of touches', () => {
    vi.useFakeTimers();
    const fire = vi.fn();
    const t = createReopenThrottle(fire, 5000);
    for (let i = 0; i < 10; i++) { t.touch('s'); vi.advanceTimersByTime(300); }
    expect(fire).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(fire).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(20_000);
    expect(fire).toHaveBeenCalledTimes(2);
  });

  it('throttles each session on its own', () => {
    vi.useFakeTimers();
    const fire = vi.fn();
    const t = createReopenThrottle(fire, 5000);
    t.touch('a'); t.touch('b');
    expect(fire.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
  });

  it('cancel drops pending trailing reopens', () => {
    vi.useFakeTimers();
    const fire = vi.fn();
    const t = createReopenThrottle(fire, 5000);
    t.touch('s'); t.touch('s');
    t.cancel();
    vi.advanceTimersByTime(10_000);
    expect(fire).toHaveBeenCalledTimes(1);
  });
});
