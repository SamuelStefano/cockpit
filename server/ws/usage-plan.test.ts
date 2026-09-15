import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { mapPlanUsage, retryAfterMs, borrowedSnapshot, widenGap, relaxGap, GAP_MIN_MS, GAP_MAX_MS, RATE_JITTER_MS } from './usage-plan';

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

  it('com turno vivo pola em 3min; ocioso, só a cada 5min', async () => {
    const fetchMock = vi.fn(async () => reply(200));
    vi.stubGlobal('fetch', fetchMock);
    const m = await load();
    let running = true;
    m.startPlanUsageLoop(() => true, () => running);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1); // prime do boot
    await vi.advanceTimersByTimeAsync(180_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    running = false;
    await vi.advanceTimersByTimeAsync(180_000);
    expect(fetchMock).toHaveBeenCalledTimes(2); // ocioso: espera fechar os 5min
    await vi.advanceTimersByTimeAsync(180_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  // A 60s Retry-After used to cost 6 minutes of "the account refused" (5min pad
  // per consecutive 429, up to 30min). The block now ends with Retry-After plus a
  // small jitter; the memory of the 429 lives in the SPACING between reads.
  it('a 429 widens the gap between reads instead of padding the block', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(429, { 'retry-after': '60' })));
    const m = await load();
    m.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(m.planUsageCooldownUntil()).toBe(Date.now() + 60_000 + RATE_JITTER_MS);
    expect(m.planUsageGapMs()).toBe(GAP_MIN_MS * 2);

    const fetchMock = vi.fn(async () => reply(200));
    vi.stubGlobal('fetch', fetchMock);
    await vi.advanceTimersByTimeAsync(90_000);
    m.requestPlanUsageRefresh();          // block is over, but the widened gap still holds
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
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
    await vi.advanceTimersByTimeAsync(60_000);   // block over; a fresh process would read now
    second.requestPlanUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).not.toHaveBeenCalled();     // but it inherited the 2min gap from disk
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
