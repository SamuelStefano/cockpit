import { describe, it, expect, vi } from 'vitest';
import { requestArcade, subscribeArcade } from './arcade-bus';

describe('arcade-bus', () => {
  it('delivers to a live listener', () => {
    const fn = vi.fn();
    const off = subscribeArcade('runner', fn);
    requestArcade('runner');
    expect(fn).toHaveBeenCalledTimes(1);
    off();
  });

  it('holds a request until someone subscribes, once', async () => {
    requestArcade('popover');
    const fn = vi.fn();
    const off = subscribeArcade('popover', fn);
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    const again = vi.fn();
    subscribeArcade('popover', again)();
    await Promise.resolve();
    expect(again).not.toHaveBeenCalled();
  });
});
