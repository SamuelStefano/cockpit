import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('../oauth', () => ({ readOAuthToken: async () => 'token', OAUTH_BETA: 'beta' }));
vi.mock('./broadcast', () => ({ broadcast: () => {} }));

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const unified = {
  'anthropic-ratelimit-unified-5h-utilization': '0.07',
  'anthropic-ratelimit-unified-7d-utilization': '0.91',
  'anthropic-ratelimit-unified-5h-reset': '1789779600',
  'anthropic-ratelimit-unified-7d-reset': '1789873200',
};

describe('headers fallback while the usage endpoint refuses', () => {
  let dir: string;
  let cachePath: string;

  beforeEach(() => {
    vi.resetModules();
    dir = mkdtempSync(join(tmpdir(), 'usage-fallback-'));
    cachePath = join(dir, 'plan-usage.json');
    process.env.COCKPIT_PLAN_USAGE = cachePath;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env.COCKPIT_PLAN_USAGE;
    rmSync(dir, { recursive: true, force: true });
  });

  function stubFetch() {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url);
      if (url === USAGE_URL) return { ok: false, status: 429, headers: new Headers({ 'retry-after': '3600' }) } as unknown as Response;
      return { status: 200, headers: new Headers(unified), body: null } as unknown as Response;
    }));
    return calls;
  }

  it('reads the number from the messages headers right after a 429 and hides the block', async () => {
    const calls = stubFetch();
    const m = await import('./usage-plan');
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);

    expect(calls).toEqual([USAGE_URL, 'https://api.anthropic.com/v1/messages']);
    expect(m.getLastPlanUsage()).toMatchObject({ fiveHour: 7, sevenDay: 91 });
    expect(m.planUsageFrame()).toMatchObject({ blockedUntil: null, nextReadAt: null });
    expect(m.planUsageCooldownUntil()).toBeGreaterThan(Date.now());
    const disk = JSON.parse(readFileSync(cachePath, 'utf8'));
    expect(disk.cooldownUntil).toBeGreaterThan(Date.now());
    expect(disk.usage.sevenDay).toBe(91);
  });

  it('keeps reading at the pace during the block without touching the usage endpoint', async () => {
    const calls = stubFetch();
    const m = await import('./usage-plan');
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(60_000);
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(m.paceMs(m.planUsageBudget()));
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.filter((u) => u === USAGE_URL)).toHaveLength(1);
    expect(calls).toHaveLength(3);
  });

  it('reports the block again once the fallback number grows old', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === USAGE_URL) return { ok: false, status: 429, headers: new Headers({ 'retry-after': '3600' }) } as unknown as Response;
      return { status: 200, headers: new Headers(unified), body: null } as unknown as Response;
    }));
    const m = await import('./usage-plan');
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(m.GAP_MAX_MS + 1_000);
    expect(m.planUsageFrame()?.blockedUntil).toBe(m.planUsageCooldownUntil());
  });
});
