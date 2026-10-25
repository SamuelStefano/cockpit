import { describe, it, expect, vi, beforeEach } from 'vitest';

const note = vi.hoisted(() => ({ fn: vi.fn((b: unknown) => !!(b as { config?: unknown })?.config) }));
vi.mock('../ws/usage-grok', () => ({ noteGrokUsage: note.fn }));

import { askAcpBilling } from './acp-run';

beforeEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

describe('askAcpBilling', () => {
  it('feeds the ACP billing answer to the Grok meter', async () => {
    const call = vi.fn(async () => ({ config: { creditUsagePercent: 10 } }));
    expect(await askAcpBilling(call)).toBe(true);
    expect(call).toHaveBeenCalledWith('_x.ai/billing', {});
    expect(note.fn).toHaveBeenCalledWith({ config: { creditUsagePercent: 10 } });
  });

  it('method not found: false, the HTTP poller stays the source', async () => {
    expect(await askAcpBilling(async () => { throw new Error('Method not found'); })).toBe(false);
    expect(note.fn).not.toHaveBeenCalled();
  });

  it('a silent agent cannot hold the turn open', async () => {
    vi.useFakeTimers();
    const p = askAcpBilling(() => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await p).toBe(false);
  });
});
