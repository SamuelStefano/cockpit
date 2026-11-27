import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../oauth', () => ({ readOAuthToken: async () => 'tok', OAUTH_BETA: 'b' }));

import { refreshModels, resetRefreshModelsThrottle } from './models';

const realFetch = globalThis.fetch;
let calls = 0;
beforeEach(() => {
  calls = 0;
  resetRefreshModelsThrottle();
  globalThis.fetch = (async () => {
    calls++;
    return new Response(JSON.stringify({ data: [{ id: 'claude-x', display_name: 'X' }] }), { status: 200 });
  }) as typeof fetch;
});
afterEach(() => { globalThis.fetch = realFetch; });

describe('refreshModels throttle', () => {
  it('shares one request between concurrent callers', async () => {
    const [a, b] = await Promise.all([refreshModels(1_000_000), refreshModels(1_000_001)]);
    expect(calls).toBe(1);
    expect(a).toEqual(b);
  });

  it('serves the cached list inside the minimum gap, fetches again after it', async () => {
    await refreshModels(1_000_000);
    await refreshModels(1_010_000);
    expect(calls).toBe(1);
    await refreshModels(1_031_000);
    expect(calls).toBe(2);
  });
});
