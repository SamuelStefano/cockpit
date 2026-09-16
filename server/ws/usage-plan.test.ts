import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { mapPlanUsage, retryAfterMs, borrowedSnapshot, widenGap, relaxGap, pruneAttempts, budgetNextReadAt, shrinkBudget, growBudget, healRate, idleSpacingMs, paceMs, GAP_MIN_MS, GAP_MAX_MS, RATE_JITTER_MS, BUDGET_DEFAULT, BUDGET_MIN, BUDGET_MAX, BUDGET_WINDOW_MS } from './usage-plan';

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
    expect(m.planUsageCooldownUntil()).toBe(Date.now() + 600_000 + RATE_JITTER_MS);

    // Os retries rápidos de falha de rede NÃO podem valer aqui: cada tentativa
    // dentro da janela renovava o bloqueio e a barra nunca voltava.
    await vi.advanceTimersByTimeAsync(60_000);
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(900_000);
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

  // Era o "só atualiza com F5": o turno fecha, o número muda e ninguém buscava
  // até o poll de 5min. E buscar só no instante do 'done' pega o valor de antes,
  // porque a Anthropic contabiliza o turno alguns segundos depois.
  it('busca UMA vez, depois do settle, quando o turno fecha', async () => {
    const fetchMock = vi.fn(async () => reply(200));
    vi.stubGlobal('fetch', fetchMock);
    const m = await load();
    m.notePlanUsageChanged();
    m.notePlanUsageChanged();  // dois turnos em sequência coalescem
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).not.toHaveBeenCalled(); // no instante do 'done' o número ainda é o de antes
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Era o buraco que mantinha o bloqueio vivo: cooldown só na memória, então cada
  // restart do Deck (e o Samuel reinicia várias vezes num Retry-After de 1h) ia
  // bater no endpoint no boot e renovar o castigo.
  it('o castigo de 429 sobrevive ao restart do processo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(429, { 'retry-after': '3371' })));
    const first = await load();
    first.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);

    const fetchMock = vi.fn(async () => reply(200));
    vi.stubGlobal('fetch', fetchMock);
    const second = await load();               // "restart": memória zerada
    second.startPlanUsageLoop(() => true);     // prime do boot
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(second.planUsageBlockedUntil()).toBeGreaterThan(Date.now());
  });

  it('uma leitura boa limpa o castigo gravado', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(429, { 'retry-after': '1' })));
    const m = await load();
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    vi.stubGlobal('fetch', vi.fn(async () => reply(200)));
    await vi.advanceTimersByTimeAsync(6 * 60_000);   // past Retry-After, jitter and the widened gap
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(m.getPlanUsageReadAt()).toBe(Date.now());
    expect(m.planUsageBlockedUntil()).toBe(0);
  });

  // The loop asks every 15s; with a turn alive it reads at the tight spacing,
  // idle it waits the budget-derived spacing so half the hour stays in reserve.
  it('with a turn alive reads at the budget pace; idle, at double it', async () => {
    const pace = paceMs(BUDGET_DEFAULT);
    const fetchMock = vi.fn(async () => reply(200));
    vi.stubGlobal('fetch', fetchMock);
    const m = await load();
    let running = true;
    m.startPlanUsageLoop(() => true, () => running);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1); // prime do boot
    // Even with a turn alive the read waits the pace: the tight 30s spacing is
    // what burst two reads into the endpoint and bought an hour of silence.
    await vi.advanceTimersByTimeAsync(pace - GAP_MIN_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(GAP_MIN_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    running = false;
    await vi.advanceTimersByTimeAsync(idleSpacingMs(BUDGET_DEFAULT) - pace);
    expect(fetchMock).toHaveBeenCalledTimes(2); // idle: not yet
    await vi.advanceTimersByTimeAsync(pace);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('a click reads right away, ignoring the spacing', async () => {
    const fetchMock = vi.fn(async () => reply(200));
    vi.stubGlobal('fetch', fetchMock);
    const m = await load();
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(1_000);
    m.requestPlanUsageRefresh();                    // poll: inside the spacing, skipped
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    m.requestPlanUsageRefresh({ mode: 'force' });   // click: goes out
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a click never touches the endpoint during a 429 block', async () => {
    const fetchMock = vi.fn(async () => reply(429, { 'retry-after': '600' }));
    vi.stubGlobal('fetch', fetchMock);
    const m = await load();
    m.requestPlanUsageRefresh({ mode: 'force' });
    await vi.advanceTimersByTimeAsync(0);
    m.requestPlanUsageRefresh({ mode: 'force' });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(m.planUsageNextReadAt()).toBe(m.planUsageCooldownUntil());
  });

  it('the hour budget stops reads and reports when the next slot opens', async () => {
    const fetchMock = vi.fn(async () => reply(200));
    vi.stubGlobal('fetch', fetchMock);
    const m = await load();
    const start = Date.now();
    for (let i = 0; i < BUDGET_MAX + 5; i++) {
      m.requestPlanUsageRefresh({ mode: 'force' });
      await vi.advanceTimersByTimeAsync(1_000);
    }
    // Clean reads earn slots back along the way, so the hour closes at the
    // runtime budget, not at the default — and never above the ceiling.
    const spent = m.planUsageBudget();
    expect(spent).toBeGreaterThanOrEqual(BUDGET_DEFAULT);
    expect(spent).toBeLessThanOrEqual(BUDGET_MAX);
    expect(fetchMock).toHaveBeenCalledTimes(spent);
    expect(m.planUsageNextReadAt()).toBe(start + BUDGET_WINDOW_MS); // oldest stamp leaves the hour
    expect(m.planUsageBlockedUntil()).toBe(0);                      // no 429 involved

    await vi.advanceTimersByTimeAsync(BUDGET_WINDOW_MS);
    m.requestPlanUsageRefresh({ mode: 'force' });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(spent + 1);
  });

  it('the budget is shared with the sibling process through the file', async () => {
    const fetchMock = vi.fn(async () => reply(200));
    vi.stubGlobal('fetch', fetchMock);
    const first = await load();
    for (let i = 0; i < BUDGET_MAX + 5; i++) {
      first.requestPlanUsageRefresh({ mode: 'force' });
      await vi.advanceTimersByTimeAsync(1_000);
    }
    const spent = fetchMock.mock.calls.length;
    const second = await load();
    second.requestPlanUsageRefresh({ mode: 'force' });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(spent);
  });

  // A 60s Retry-After used to cost 6 minutes of "the account refused" (5min pad
  // per consecutive 429, up to 30min). The block now ends with Retry-After plus a
  // small jitter; the memory of the 429 lives in the SPACING between reads.
  it('a 429 widens the gap between reads instead of padding the block', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(429, { 'retry-after': '10' })));
    const m = await load();
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(m.planUsageCooldownUntil()).toBe(Date.now() + 10_000 + RATE_JITTER_MS);
    expect(m.planUsageGapMs()).toBe(GAP_MIN_MS * 2);

    const fetchMock = vi.fn(async () => reply(200));
    vi.stubGlobal('fetch', fetchMock);
    await vi.advanceTimersByTimeAsync(40_000);
    m.requestPlanUsageRefresh();          // block is over, but the spacing still holds
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(paceMs(BUDGET_DEFAULT));
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('the widened gap is shared with the sibling process through the file', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(429, { 'retry-after': '1' })));
    const first = await load();
    first.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(first.planUsageGapMs()).toBe(GAP_MIN_MS * 2);

    const fetchMock = vi.fn(async () => reply(200));
    vi.stubGlobal('fetch', fetchMock);
    const second = await load();
    await vi.advanceTimersByTimeAsync(GAP_MIN_MS + 15_000);   // block over; a fresh process would read now
    second.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).not.toHaveBeenCalled();     // but it inherited the doubled gap from disk
    expect(second.planUsageGapMs()).toBe(GAP_MIN_MS * 2);
  });

  it('two processes share one attempt clock: the second does not read right after the first', async () => {
    const fetchMock = vi.fn(async () => reply(429, { 'retry-after': '0' }));
    vi.stubGlobal('fetch', fetchMock);
    const first = await load();
    first.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(RATE_JITTER_MS + 1_000);
    const second = await load();
    second.requestPlanUsageRefresh();               // 21s after the first attempt, below the gap
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

});

describe('lease entre os dois processos que pollam', () => {
  let dir: string;
  const other = { ts: 0, usage: { fiveHour: 42, sevenDay: 7, resetsAt: null, sevenDayResetsAt: null, limits: [] } };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'usage-lease-'));
    process.env.COCKPIT_PLAN_USAGE = join(dir, 'plan-usage.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.COCKPIT_PLAN_USAGE;
    vi.unstubAllGlobals();
  });

  async function load() {
    vi.resetModules();
    return import('./usage-plan');
  }

  const writeOther = () => writeFileSync(process.env.COCKPIT_PLAN_USAGE!, JSON.stringify({ ...other, ts: Date.now() }), 'utf8');

  it('adota o snapshot do irmão em vez de ir à rede', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('não deveria buscar'); });
    vi.stubGlobal('fetch', fetchMock);
    writeOther();
    const m = await load();
    m.requestPlanUsageRefresh();
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(m.getLastPlanUsage()?.fiveHour).toBe(42);
  });

  it('adota mesmo em cooldown de 429 — o castigo é do processo, não do dado', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 429, headers: new Headers({ 'retry-after': '600' }), json: async () => ({}) }) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    const m = await load();
    m.requestPlanUsageRefresh();
    await new Promise((r) => setTimeout(r, 0));
    expect(m.planUsageCooldownUntil()).toBeGreaterThan(Date.now());
    expect(m.getLastPlanUsage()).toBeNull();

    writeOther();
    m.requestPlanUsageRefresh();
    await new Promise((r) => setTimeout(r, 0));
    expect(m.getLastPlanUsage()?.fiveHour).toBe(42);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  // Adopting only ONCE per sibling write sent every later call to the network,
  // even with a fresh snapshot sitting on disk — both processes kept polling.
  it('keeps skipping the network while the sibling snapshot is fresh', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('should not fetch'); });
    vi.stubGlobal('fetch', fetchMock);
    writeOther();
    const m = await load();
    m.requestPlanUsageRefresh();
    await new Promise((r) => setTimeout(r, 0));
    m.requestPlanUsageRefresh();
    m.requestPlanUsageRefresh();
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(m.getLastPlanUsage()?.fiveHour).toBe(42);
  });

});

describe('adaptive gap', () => {
  it('doubles on a 429 and never exceeds the ceiling', () => {
    expect(widenGap(GAP_MIN_MS)).toBe(GAP_MIN_MS * 2);
    expect(widenGap(GAP_MAX_MS)).toBe(GAP_MAX_MS);
  });

  it('halves back after a run of clean reads, never below the floor', () => {
    expect(relaxGap(GAP_MIN_MS * 4, 3)).toEqual({ gapMs: GAP_MIN_MS * 4, okStreak: 3 });
    expect(relaxGap(GAP_MIN_MS * 4, 6)).toEqual({ gapMs: GAP_MIN_MS * 2, okStreak: 0 });
    expect(relaxGap(GAP_MIN_MS, 6)).toEqual({ gapMs: GAP_MIN_MS, okStreak: 0 });
  });
});

describe('hour budget', () => {
  const now = 10 * BUDGET_WINDOW_MS;
  const stamps = (n: number, from = now - 30 * 60_000) => Array.from({ length: n }, (_, i) => from + i * 60_000);

  it('keeps only the stamps inside the rolling hour, oldest first', () => {
    const list = [now - BUDGET_WINDOW_MS, now - 1_000, now - BUDGET_WINDOW_MS + 1, now + 5_000];
    expect(pruneAttempts(list, now)).toEqual([now - BUDGET_WINDOW_MS + 1, now - 1_000]);
  });

  it('allows a read below the budget and points at the oldest stamp otherwise', () => {
    expect(budgetNextReadAt(stamps(5), 6, now)).toBe(0);
    const full = stamps(6);
    expect(budgetNextReadAt(full, 6, now)).toBe(full[0] + BUDGET_WINDOW_MS);
  });

  it('a 429 after a heavy hour keeps 3/4 of what the hour accepted', () => {
    expect(shrinkBudget(31, stamps(31), now)).toBe(23);
    expect(shrinkBudget(BUDGET_DEFAULT, stamps(40, now - 45 * 60_000), now)).toBe(BUDGET_DEFAULT); // never grows on a 429
    expect(shrinkBudget(BUDGET_DEFAULT, stamps(12), now)).toBe(9);
    expect(shrinkBudget(8, stamps(12), now)).toBe(8); // already under what the hour accepted
    expect(BUDGET_MIN).toBeLessThanOrEqual(Math.floor(12 * 0.75)); // the floor never beats real evidence
  });

  it('a 429 right after a block ended is punishment carry-over, not budget information', () => {
    expect(shrinkBudget(BUDGET_DEFAULT, stamps(2), now)).toBe(BUDGET_DEFAULT);
  });

  it('clean reads earn a slot back, up to the ceiling', () => {
    expect(growBudget(10, 2)).toEqual({ budget: 10, budgetStreak: 2 });
    expect(growBudget(10, 3)).toEqual({ budget: 11, budgetStreak: 0 });
    expect(growBudget(BUDGET_MAX, 3)).toEqual({ budget: BUDGET_MAX, budgetStreak: 0 });
  });

  it('a clean rolling hour earns ONE slot back, never a jump to the default', () => {
    expect(healRate(9, now - 30 * 60_000, now)).toBeNull();
    // The jump to BUDGET_DEFAULT with a 30s gap is what bought the hour-long
    // blackouts: it spent the 429's lesson and burst on the very next tick.
    expect(healRate(9, now - BUDGET_WINDOW_MS, now)).toEqual({ budget: 10, gapMs: paceMs(10), rateAt: now });
    expect(healRate(BUDGET_MAX, now - BUDGET_WINDOW_MS, now)?.budget).toBe(BUDGET_MAX);
  });

  it('a heal moves the clock, so a clean hour cannot heal on every read', () => {
    const first = healRate(9, now - BUDGET_WINDOW_MS, now)!;
    expect(healRate(first.budget, first.rateAt, now + 60_000)).toBeNull();
  });

  it('an account that never answered 429 has nothing to heal', () => {
    expect(healRate(BUDGET_MAX, 0, now)).toBeNull();
  });

  it('the pace spreads the budget over the hour and idle keeps half in reserve', () => {
    expect(paceMs(12)).toBe(5 * 60_000);
    expect(idleSpacingMs(24)).toBe(5 * 60_000);
    expect(idleSpacingMs(6)).toBe(20 * 60_000);
  });
});

describe('borrowedSnapshot', () => {
  const usage = { fiveHour: 42, sevenDay: 7, resetsAt: null, sevenDayResetsAt: null, limits: [] };
  const now = 1_000_000;

  it('adota o snapshot fresco do processo irmão', () => {
    expect(borrowedSnapshot({ ts: now - 60_000, usage }, 0, now)).toEqual(usage);
  });

  it('nunca adota o que ele mesmo escreveu — senão nunca mais buscaria nada', () => {
    expect(borrowedSnapshot({ ts: now - 60_000, usage }, now - 60_000, now)).toBeNull();
  });

  it('snapshot velho não serve de lease: o irmão pode ter morrido', () => {
    expect(borrowedSnapshot({ ts: now - 10 * 60_000, usage }, 0, now)).toBeNull();
  });

  it('sem arquivo, sem lease', () => {
    expect(borrowedSnapshot(null, 0, now)).toBeNull();
  });
});

describe('fetch pendurado', () => {
  it('aborta por timeout em vez de travar o refresh pra sempre', async () => {
    // Um fetch que nunca resolve deixava `refreshing` ligado e TODA chamada
    // seguinte voltava na primeira linha — a barra morria calada.
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const m = await import('./usage-plan');
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(fetchMock.mock.calls[0][1]?.signal).toBeTruthy();

    // Destravou: a próxima rodada consegue sair.
    await vi.advanceTimersByTimeAsync(60_000);
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
