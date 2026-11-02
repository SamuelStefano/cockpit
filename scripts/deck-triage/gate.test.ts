import { describe, expect, it } from 'vitest';
import type { Check } from './checks.ts';
import { confirmFailing, decide, initialOutage, stepOutage } from './gate.ts';
import type { Incident } from './incidents.ts';

const MIN = 60_000;
const NOW = Date.parse('2026-10-28T16:00:00Z');
const A = '7c2477ed-dab2-457a-a5ab-0efa1cfba8c3';
const B = '8e12b819-2a73-4bd5-9e9f-5fdf400e03af';
const C = '33333333-3333-4333-8333-333333333333';
const TRUSTED = new Set(['samuelstefanodocarmo@gmail.com', 'taigfs@gmail.com']);

const inc = (account: string, firstAgo: number, lastAgo = 0, extra: Partial<Incident> = {}): Incident => ({
  id: account.slice(0, 4), kind: 'relay-unreachable', accountId: account, firstAt: NOW - firstAgo, lastAt: NOW - lastAgo, count: 1, reports: [], state: 'pending', email: null, ...extra,
});
const fail = (id: Check['id']): Check => ({ id, status: 'fail', detail: 'x' });

describe('decide', () => {
  it('confirms when a synthetic check fails', () => {
    const i = inc(C, 0);
    expect(decide(i, [fail('dns_cf')], [i], NOW)).toMatchObject({ verdict: 'confirmed', reason: expect.stringContaining('dns_cf') });
  });

  it('suppresses a single fresh report while synthetics are green', () => {
    const i = inc(C, 2 * MIN);
    expect(decide(i, [], [i], NOW).verdict).toBe('suppress');
  });

  it('confirms when 2 accounts report the same kind within 10 min', () => {
    const i = inc(C, MIN);
    const other = inc(A, 3 * MIN, 3 * MIN);
    expect(decide(i, [], [i, other], NOW)).toMatchObject({ verdict: 'confirmed', reason: '2 contas com relay-unreachable em 10 min' });
  });

  it('does not count another account outside 10 min or of another kind', () => {
    const i = inc(C, MIN);
    const old = inc(A, 30 * MIN, 12 * MIN);
    const otherKind = inc(B, MIN, 0, { kind: 'js-error' });
    expect(decide(i, [], [i, old, otherKind], NOW).verdict).toBe('suppress');
  });

  it('stays quiet for one account, however long it persists', () => {
    const i = inc(A, 30 * MIN, 0, { count: 9 });
    expect(decide(i, [], [i], NOW).verdict).toBe('suppress');
  });

  it('stays quiet for routine kinds across accounts while checks are green', () => {
    for (const kind of ['login-refused', 'unclean-exit', 'js-error']) {
      const a = inc(A, 0, 0, { kind });
      const b = inc(C, 0, 0, { kind });
      expect(decide(a, [], [a, b], NOW).verdict).toBe('suppress');
      expect(decide(a, [fail('ws_upgrade')], [a, b], NOW).verdict).toBe('confirmed');
    }
  });

  it('keeps one account quiet when it has few reports or has not persisted', () => {
    const few = inc(C, 11 * MIN, 0, { count: 2 });
    const short = inc(C, 9 * MIN, 0, { count: 5 });
    expect(decide(few, [], [few], NOW).verdict).toBe('suppress');
    expect(decide(short, [], [short], NOW).verdict).toBe('suppress');
  });

  it('escalates a trusted reporter at once for a manual report, even with green synthetics', () => {
    const i = inc(B, 0, 0, { kind: 'manual', email: 'TaiGFS@gmail.com' });
    expect(decide(i, [], [i], NOW, TRUSTED)).toEqual({ verdict: 'confirmed', reason: 'reportado por TaiGFS@gmail.com (confiável)', trusted: 'TaiGFS@gmail.com' });
  });

  it('does not escalate an auto-filed report on the trusted bypass', () => {
    for (const kind of ['relay-unreachable', 'login-refused', 'unclean-exit', 'js-error']) {
      const i = inc(A, 0, 0, { kind, email: 'samuelstefanodocarmo@gmail.com' });
      expect(decide(i, [], [i], NOW, TRUSTED).verdict).toBe('suppress');
    }
  });

  it('still confirms an auto-filed report from a trusted email when a check is failing', () => {
    const fresh = inc(A, 0, 0, { kind: 'login-refused', email: 'samuelstefanodocarmo@gmail.com' });
    expect(decide(fresh, [fail('ws_upgrade')], [fresh], NOW, TRUSTED).verdict).toBe('confirmed');
  });

  it('keeps the trusted reporter on a synthetic outage', () => {
    const i = inc(A, 0, 0, { email: 'samuelstefanodocarmo@gmail.com' });
    expect(decide(i, [fail('ws_upgrade')], [i], NOW, TRUSTED)).toMatchObject({ verdict: 'confirmed', trusted: 'samuelstefanodocarmo@gmail.com' });
  });

  it('an email off the list, or an unresolved one, goes through the normal gate', () => {
    expect(decide(inc(C, 0, 0, { email: 'x@y.com' }), [], [], NOW, TRUSTED).verdict).toBe('suppress');
    expect(decide(inc(A, 0), [], [], NOW, TRUSTED).verdict).toBe('suppress');
  });
});

describe('stepOutage', () => {
  it('opens silently, announces after 5 min, recovers once', () => {
    let r = stepOutage(initialOutage(), [fail('dns_cf')], NOW);
    expect(r.event).toEqual({ type: 'opened', failing: ['dns_cf'] });
    r = stepOutage(r.state, [fail('dns_cf'), fail('ws_upgrade')], NOW + 2 * MIN);
    expect(r.event.type).toBe('none');
    r = stepOutage(r.state, [fail('dns_cf')], NOW + 5 * MIN);
    expect(r.event).toEqual({ type: 'down', failing: ['dns_cf'] });
    r = stepOutage(r.state, [fail('dns_cf')], NOW + 8 * MIN);
    expect(r.event.type).toBe('none');
    r = stepOutage(r.state, [], NOW + 12 * MIN);
    expect(r.event).toEqual({ type: 'recovered', downMs: 12 * MIN, announced: true });
    expect(stepOutage(r.state, [], NOW + 14 * MIN).event.type).toBe('none');
  });

  it('a blip that recovers before the announcement is recovered with announced=false', () => {
    let r = stepOutage(initialOutage(), [fail('ssh')], NOW);
    r = stepOutage(r.state, [], NOW + 2 * MIN);
    expect(r.event).toEqual({ type: 'recovered', downMs: 2 * MIN, announced: false });
  });
});

describe('confirmFailing', () => {
  it('drops a check that passes on the re-run', async () => {
    const runs = [[fail('dns_cf'), fail('ssh')], [fail('ssh')]];
    let slept = 0;
    const out = await confirmFailing(async () => runs.shift()!, async () => { slept++; });
    expect(out.map((c) => c.id)).toEqual(['ssh']);
    expect(slept).toBe(1);
  });

  it('runs once when everything is green', async () => {
    let calls = 0;
    expect(await confirmFailing(async () => { calls++; return []; }, async () => {})).toEqual([]);
    expect(calls).toBe(1);
  });
});
