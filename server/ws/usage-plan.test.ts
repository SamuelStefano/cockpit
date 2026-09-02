import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { mapPlanUsage, retryAfterMs } from './usage-plan';

vi.mock('../oauth', () => ({ readOAuthToken: async () => 'token', OAUTH_BETA: 'beta' }));
vi.mock('./broadcast', () => ({ broadcast: () => {} }));

describe('mapPlanUsage', () => {
  it('maps the live shape from /api/oauth/usage', () => {
    const u = mapPlanUsage({
      five_hour: { utilization: 54.0, resets_at: '2026-06-07T04:50:00.702863+00:00' },
      seven_day: { utilization: 1.0, resets_at: '2026-06-09T03:00:00.000000+00:00' },
    });
    expect(u.fiveHour).toBe(54);
    expect(u.sevenDay).toBe(1);
    expect(u.resetsAt).toBe(Date.parse('2026-06-07T04:50:00.702863+00:00'));
    expect(u.sevenDayResetsAt).toBe(Date.parse('2026-06-09T03:00:00.000000+00:00'));
  });

  it('rounds and clamps utilization to 0..100', () => {
    expect(mapPlanUsage({ five_hour: { utilization: 47.6 } }).fiveHour).toBe(48);
    expect(mapPlanUsage({ five_hour: { utilization: -5 } }).fiveHour).toBe(0);
    expect(mapPlanUsage({ five_hour: { utilization: 250 } }).fiveHour).toBe(100);
  });

  it('defaults missing fields safely', () => {
    const empty = { fiveHour: 0, sevenDay: 0, resetsAt: null, sevenDayResetsAt: null, limits: [] };
    expect(mapPlanUsage({})).toEqual(empty);
    expect(mapPlanUsage(null)).toEqual(empty);
  });

  it('returns null resetsAt for an unparseable date', () => {
    expect(mapPlanUsage({ five_hour: { resets_at: 'not-a-date' } }).resetsAt).toBeNull();
  });

  it('names a model-scoped weekly limit by its display_name', () => {
    const u = mapPlanUsage({
      limits: [
        { kind: 'session', percent: 19, severity: 'normal', resets_at: '2026-07-31T23:20:00Z' },
        { kind: 'weekly_all', percent: 76, severity: 'warning', resets_at: '2026-08-02T03:00:00Z' },
        { kind: 'weekly_scoped', percent: 0, severity: 'normal', scope: { model: { display_name: 'Fable' } } },
      ],
    });
    expect(u.limits.map((l) => l.label)).toEqual(['Sessão (5h)', 'Semanal', 'Fable']);
    expect(u.limits[1].severity).toBe('warning');
    expect(u.limits[2].scoped).toBe(true);
    expect(u.limits[0].scoped).toBe(false);
  });

  it('survives a limits payload that is not a list or has junk entries', () => {
    expect(mapPlanUsage({ limits: 'nope' }).limits).toEqual([]);
    const u = mapPlanUsage({ limits: [null, { kind: 'weekly_scoped', scope: { model: null } }] });
    expect(u.limits).toHaveLength(2);
    expect(u.limits[0].label).toBe('Limite');
    expect(u.limits[1].label).toBe('Semanal');
  });
});

describe('retryAfterMs', () => {
  it('reads a delay in seconds', () => {
    expect(retryAfterMs('2385')).toBe(2_385_000);
    expect(retryAfterMs(' 30 ')).toBe(30_000);
  });

  it('reads an HTTP-date relative to now', () => {
    const now = Date.parse('2026-09-02T13:00:00Z');
    expect(retryAfterMs('Wed, 02 Sep 2026 13:10:00 GMT', now)).toBe(600_000);
  });

  it('returns 0 when absent, junk or already past', () => {
    expect(retryAfterMs(null)).toBe(0);
    expect(retryAfterMs('depois')).toBe(0);
    expect(retryAfterMs('Wed, 02 Sep 2026 12:00:00 GMT', Date.parse('2026-09-02T13:00:00Z'))).toBe(0);
  });
});

describe('requestPlanUsageRefresh', () => {
  let dir: string;
  const ok = { five_hour: { utilization: 10 }, seven_day: { utilization: 5 } };

  async function load() {
    vi.resetModules();
    process.env.COCKPIT_PLAN_USAGE = join(dir, 'plan-usage.json');
    return import('./usage-plan');
  }

  const reply = (status: number, headers: Record<string, string> = {}) =>
    ({ ok: status < 400, status, headers: new Headers(headers), json: async () => ok }) as unknown as Response;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'usage-plan-'));
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
    delete process.env.COCKPIT_PLAN_USAGE;
  });

  it('coalesces a burst of refreshes into one request', async () => {
    const fetchMock = vi.fn(async () => reply(200));
    vi.stubGlobal('fetch', fetchMock);
    const m = await load();
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    m.requestPlanUsageRefresh();
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(m.getLastPlanUsage()?.fiveHour).toBe(10);
  });

  it('honors Retry-After on 429 and stops touching the endpoint until it passes', async () => {
    const fetchMock = vi.fn(async () => reply(429, { 'retry-after': '600' }));
    vi.stubGlobal('fetch', fetchMock);
    const m = await load();
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(m.planUsageCooldownUntil()).toBe(Date.now() + 600_000);

    // Os retries rápidos de falha de rede NÃO podem valer aqui: cada tentativa
    // dentro da janela renovava o bloqueio e a barra nunca voltava.
    await vi.advanceTimersByTimeAsync(60_000);
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(600_000);
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('still retries fast on a network failure', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('offline'); });
    vi.stubGlobal('fetch', fetchMock);
    const m = await load();
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(8_000);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it('reuses the last snapshot from disk when the boot fetch is blocked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(200)));
    const first = await load();
    first.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);

    vi.stubGlobal('fetch', vi.fn(async () => reply(429, { 'retry-after': '2385' })));
    const second = await load();
    second.startPlanUsageLoop(() => false);
    await vi.advanceTimersByTimeAsync(0);
    expect(second.getLastPlanUsage()?.fiveHour).toBe(10);
  });
});
