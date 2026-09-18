import { describe, it, expect, vi, afterEach } from 'vitest';
import type { PlanUsage } from '../../shared/protocol';

vi.mock('../oauth', () => ({ readOAuthToken: async () => 'token', OAUTH_BETA: 'beta' }));

import { mapUnifiedHeaders, mergeHeaderUsage, fetchUsageFromHeaders } from './usage-headers';

const headers = (o: Record<string, string>) => new Headers(o);
const full = {
  'anthropic-ratelimit-unified-5h-utilization': '0.05',
  'anthropic-ratelimit-unified-7d-utilization': '0.9',
  'anthropic-ratelimit-unified-5h-reset': '1789779600',
  'anthropic-ratelimit-unified-7d-reset': '1789873200',
  'anthropic-ratelimit-unified-5h-status': 'allowed',
  'anthropic-ratelimit-unified-7d-status': 'allowed_warning',
};

afterEach(() => vi.unstubAllGlobals());

describe('mapUnifiedHeaders', () => {
  it('turns ratios into percentages and epoch seconds into ms', () => {
    expect(mapUnifiedHeaders(headers(full))).toEqual({
      fiveHour: 5, sevenDay: 90, resetsAt: 1789779600000, sevenDayResetsAt: 1789873200000,
      fiveHourStatus: 'allowed', sevenDayStatus: 'allowed_warning',
    });
  });

  it('returns null when the answer carries no utilization', () => {
    expect(mapUnifiedHeaders(headers({ 'anthropic-ratelimit-unified-5h-status': 'allowed' }))).toBeNull();
  });

  it('clamps a window above its ceiling', () => {
    const h = mapUnifiedHeaders(headers({ ...full, 'anthropic-ratelimit-unified-5h-utilization': '1.3' }));
    expect(h?.fiveHour).toBe(100);
  });
});

describe('mergeHeaderUsage', () => {
  const h = mapUnifiedHeaders(headers(full))!;

  it('builds the two account rows when there was no earlier read', () => {
    const u = mergeHeaderUsage(null, h);
    expect(u.limits.map((l) => [l.id, l.pct, l.severity])).toEqual([
      ['session-0', 5, 'normal'],
      ['weekly_all-1', 90, 'critical'],
    ]);
    expect(u.fiveHour).toBe(5);
    expect(u.sevenDayResetsAt).toBe(1789873200000);
  });

  it('keeps the per-model row from the last full read and refreshes the account rows', () => {
    const prev: PlanUsage = {
      fiveHour: 1, sevenDay: 80, resetsAt: 1, sevenDayResetsAt: 2,
      limits: [
        { id: 'session-0', label: 'Sessão (5h)', pct: 1, resetsAt: 1, severity: 'normal', scoped: false },
        { id: 'weekly_all-1', label: 'Semanal', pct: 80, resetsAt: 2, severity: 'warning', scoped: false },
        { id: 'weekly_scoped-2', label: 'Fable', pct: 83, resetsAt: 3, severity: 'warning', scoped: true },
      ],
    };
    const u = mergeHeaderUsage(prev, h);
    expect(u.limits.map((l) => [l.id, l.pct])).toEqual([['session-0', 5], ['weekly_all-1', 90], ['weekly_scoped-2', 83]]);
  });

  it('survives a cache entry with no limits at all', () => {
    expect(mergeHeaderUsage({} as PlanUsage, h).limits).toHaveLength(2);
  });
});

describe('fetchUsageFromHeaders', () => {
  it('reads the headers even from a refused request', async () => {
    const fetchMock = vi.fn(async () => ({ status: 429, headers: headers(full), body: null }) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    expect((await fetchUsageFromHeaders())?.sevenDay).toBe(90);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(JSON.parse(String(init.body)).max_tokens).toBe(1);
  });

  it('returns null on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
    expect(await fetchUsageFromHeaders()).toBeNull();
  });
});
