import { describe, it, expect, vi } from 'vitest';
import { capacityFrame, createCapacityPublisher } from './capacity';
import { threads, type Thread } from './threads';

describe('capacityFrame', () => {
  it('lets memory lower the cap below the configured ceiling', () => {
    expect(capacityFrame(2, 1500, 4)).toEqual({ t: 'capacity', live: 2, cap: 4, configCap: 4, availMb: 1500 });
    expect(capacityFrame(2, 1100, 12)).toMatchObject({ cap: 4, configCap: 12 });
  });

  it('never reports a cap below one', () => {
    expect(capacityFrame(0, 100, 12).cap).toBe(1);
  });
});

describe('createCapacityPublisher', () => {
  const setup = (reading: { live: number; availMb: number }) => {
    const emit = vi.fn();
    const pub = createCapacityPublisher({ read: () => reading, configCap: 12, emit });
    return { emit, pub, reading };
  };

  it('emits the first reading, then only when live or cap change', () => {
    const { emit, pub, reading } = setup({ live: 1, availMb: 1500 });
    pub.check();
    pub.check();
    expect(emit).toHaveBeenCalledTimes(1);
    reading.live = 2;
    pub.check();
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ live: 2, cap: 5 }));
  });

  it('emits when memory moves the cap even with the same live count', () => {
    const { emit, pub, reading } = setup({ live: 2, availMb: 1500 });
    pub.check();
    reading.availMb = 400;
    pub.check();
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ live: 2, cap: 2 }));
  });

  it('stays quiet when only the megabytes jitter', () => {
    const { emit, pub, reading } = setup({ live: 2, availMb: 1500 });
    pub.check();
    reading.availMb = 1520;
    pub.check();
    expect(emit).toHaveBeenCalledTimes(1);
  });
});

describe('threads change hook', () => {
  it('fires when a run is added or removed, not when one is replaced', () => {
    const hook = vi.fn();
    threads.onChange = hook;
    const t = {} as Thread;
    threads.set('a', t);
    threads.set('a', t);
    threads.delete('a');
    threads.delete('a');
    expect(hook).toHaveBeenCalledTimes(2);
    threads.onChange = null;
  });
});
