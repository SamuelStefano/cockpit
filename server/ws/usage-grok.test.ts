import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const auth = vi.hoisted(() => ({ token: 'secret-grok-token' as string | null }));
const sent = vi.hoisted(() => ({ frames: [] as unknown[] }));
vi.mock('../grok-auth', () => ({ readGrokToken: async () => auth.token }));
vi.mock('./broadcast', () => ({ broadcast: (f: unknown) => { sent.frames.push(f); } }));
vi.mock('../oauth', () => ({ readOAuthToken: async () => null, OAUTH_BETA: 'beta' }));
vi.mock('./usage-headers', () => ({ fetchUsageFromHeaders: async () => null, mergeHeaderUsage: (p: unknown) => p }));

import { mapGrokBilling, requestGrokUsageRefresh, grokUsageFrame, noteGrokUsage, resetGrokUsageForTest, startGrokUsageLoop, getLastGrokUsage, GROK_BUDGET } from './usage-grok';

const END = '2026-11-01T00:00:00Z';
const body = { config: { creditUsagePercent: 41.6, currentPeriod: { end: END } } };
const json = (status: number, b: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('mapGrokBilling', () => {
  it('maps creditUsagePercent and the period end', () => {
    const u = mapGrokBilling(body)!;
    expect(u.fiveHour).toBe(42);
    expect(u.resetsAt).toBe(Date.parse(END));
    expect(u.limits).toEqual([{ id: 'grok-credits', label: 'Créditos do período', pct: 42, resetsAt: Date.parse(END), severity: 'normal', scoped: false }]);
  });

  it('falls back to onDemandUsed / onDemandCap, int64 as string included', () => {
    expect(mapGrokBilling({ config: { onDemandUsed: { val: '250' }, onDemandCap: { val: 1000 } } })!.fiveHour).toBe(25);
  });

  it('reads billingPeriodEnd as ISO or epoch seconds', () => {
    expect(mapGrokBilling({ config: { creditUsagePercent: 1, billingPeriodEnd: END } })!.resetsAt).toBe(Date.parse(END));
    expect(mapGrokBilling({ config: { creditUsagePercent: 1, billingPeriodEnd: 1_800_000_000 } })!.resetsAt).toBe(1_800_000_000_000);
  });

  it('clamps to 0..100', () => {
    expect(mapGrokBilling({ config: { creditUsagePercent: 180 } })!.fiveHour).toBe(100);
    expect(mapGrokBilling({ config: { creditUsagePercent: -3 } })!.fiveHour).toBe(0);
  });

  it('never invents a percentage', () => {
    expect(mapGrokBilling({})).toBeNull();
    expect(mapGrokBilling(null)).toBeNull();
    expect(mapGrokBilling({ config: { onDemandUsed: { val: 5 }, onDemandCap: { val: 0 } } })).toBeNull();
    expect(mapGrokBilling({ config: { creditUsagePercent: 'n/a' } })).toBeNull();
  });
});

describe('grok usage poller', () => {
  let dir: string;
  let fetchMock: ReturnType<typeof vi.fn>;
  let logs: string[];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'grok-usage-'));
    process.env.COCKPIT_GROK_USAGE = join(dir, 'grok-plan-usage.json');
    auth.token = 'secret-grok-token';
    sent.frames = [];
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((m: unknown) => { logs.push(String(m)); });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    resetGrokUsageForTest();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete process.env.COCKPIT_GROK_USAGE;
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads with the CLI headers, broadcasts only numbers and writes the cache', async () => {
    fetchMock.mockResolvedValue(json(200, body));
    await requestGrokUsageRefresh('force');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://cli-chat-proxy.grok.com/v1/billing?format=credits');
    expect(init.headers).toMatchObject({ authorization: 'Bearer secret-grok-token', 'x-xai-token-auth': 'xai-grok-cli' });
    expect(grokUsageFrame()?.usage?.fiveHour).toBe(42);
    expect(JSON.stringify(sent.frames)).not.toContain('secret-grok-token');
    expect(logs.join('\n')).not.toContain('secret-grok-token');
    const disk = JSON.parse(readFileSync(process.env.COCKPIT_GROK_USAGE!, 'utf8'));
    expect(disk.usage.fiveHour).toBe(42);
    expect(JSON.stringify(disk)).not.toContain('secret-grok-token');
  });

  it('honors 429 Retry-After: no second request until the block ends', async () => {
    fetchMock.mockResolvedValue(json(429, {}, { 'retry-after': '600' }));
    await requestGrokUsageRefresh('force');
    const f = grokUsageFrame()!;
    expect(f.usage).toBeNull();
    expect(f.blockedUntil).toBeGreaterThan(Date.now() + 590_000);
    await requestGrokUsageRefresh('force');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logs.some((l) => l.startsWith('[grok-usage]') && l.includes('429'))).toBe(true);
  });

  it('a 401 keeps the last number and logs, without inventing one', async () => {
    noteGrokUsage(body);
    vi.useFakeTimers({ now: Date.now() + 60 * 60_000, toFake: ['Date'] });
    fetchMock.mockResolvedValue(json(401, { error: 'unauthorized' }));
    await requestGrokUsageRefresh('force');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getLastGrokUsage()?.fiveHour).toBe(42);
    expect(logs.some((l) => l.startsWith('[grok-usage]') && l.includes('401'))).toBe(true);
  });

  it('no login: no request, no number, no crash', async () => {
    auth.token = null;
    await requestGrokUsageRefresh('force');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(grokUsageFrame()).toBeNull();
    expect(grokUsageFrame(Date.now(), true)?.usage).toBeNull();
  });

  it('a body without a number fails closed', async () => {
    fetchMock.mockResolvedValue(json(200, { config: {} }));
    await requestGrokUsageRefresh('force');
    expect(getLastGrokUsage()).toBeNull();
  });

  it('boots from the disk cache and adopts a fresh one instead of reading', async () => {
    const usage = mapGrokBilling(body);
    writeFileSync(process.env.COCKPIT_GROK_USAGE!, JSON.stringify({ ts: Date.now() - 1000, usage }));
    startGrokUsageLoop(() => false);
    expect(getLastGrokUsage()?.fiveHour).toBe(42);
    await requestGrokUsageRefresh('active');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('spends at most the hour budget, even on clicks', async () => {
    fetchMock.mockImplementation(async () => json(200, body));
    let t = Date.now();
    vi.useFakeTimers({ now: t, toFake: ['Date'] });
    for (let i = 0; i < 13; i++) {
      await requestGrokUsageRefresh('force');
      t += 31_000;
      vi.setSystemTime(t);
    }
    expect(fetchMock).toHaveBeenCalledTimes(GROK_BUDGET);
    expect(grokUsageFrame()!.nextReadAt).toBeGreaterThan(Date.now());
  });

  it('a 429 written by the sibling process blocks this one too', async () => {
    writeFileSync(process.env.COCKPIT_GROK_USAGE!, JSON.stringify({ ts: 0, usage: null, cooldownUntil: Date.now() + 60_000 }));
    await requestGrokUsageRefresh('force');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
