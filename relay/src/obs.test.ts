import { describe, it, expect, vi, afterEach } from 'vitest';
import { createObs, readRevision } from './obs';

afterEach(() => vi.restoreAllMocks());

describe('createObs', () => {
  it('hashes ids with a salted HMAC, 10 hex chars', () => {
    const a = createObs({ salt: 's1' });
    const b = createObs({ salt: 's2' });
    expect(a.hid('user-1')).toMatch(/^[0-9a-f]{10}$/);
    expect(a.hid('user-1')).toBe(a.hid('user-1'));
    expect(a.hid('user-1')).not.toBe(b.hid('user-1'));
    expect(a.hid('user-1')).not.toBe(a.hid('user-2'));
  });

  it('uses a random salt per process when none is given', () => {
    expect(createObs().hid('x')).not.toBe(createObs().hid('x'));
  });

  it('writes one JSON line to stdout and keeps only allowlisted primitive fields', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const o = createObs({ salt: 's', now: () => 0 });
    o.event('x', { n: 1, b: true, s: 'a'.repeat(100), obj: { a: 1 }, arr: [1], u: undefined, nan: NaN, 'Bad Key': 'k', ev: 'spoof' });
    expect(log).toHaveBeenCalledTimes(1);
    const line = JSON.parse(log.mock.calls[0][0] as string);
    expect(line).toEqual({ t: '1970-01-01T00:00:00.000Z', ev: 'x', n: 1, b: true, s: 'a'.repeat(60) });
  });

  it('caps the ring buffer and counts ev and ev:code', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const o = createObs({ ringSize: 3 });
    for (let i = 0; i < 5; i++) o.event('browser_close', { code: 4401, i });
    o.event('browser_close', { code: 1006 });
    o.event('other');
    const r = o.recent();
    expect(r).toHaveLength(3);
    expect(r[2].ev).toBe('other');
    expect(o.counters()).toMatchObject({ browser_close: 6, 'browser_close:4401': 5, 'browser_close:1006': 1, other: 1 });
  });
});

describe('clientReport', () => {
  const o = () => { vi.spyOn(console, 'log').mockImplementation(() => {}); return createObs(); };
  it('accepts a valid beacon and drops unknown fields', () => {
    const x = o();
    expect(x.clientReport({ v: 1, kind: 'ws_offline', closeCode: 1006, ua: 'chrome', mobile: true, email: 'a@b.c', extra: 1 })).toBe(true);
    const e = x.recent()[0];
    expect(e).toMatchObject({ ev: 'client_ws_offline', code: 1006, ua: 'chrome', mobile: true });
    expect(e).not.toHaveProperty('email');
    expect(e).not.toHaveProperty('extra');
  });
  it.each([
    null, [], { v: 2, kind: 'ws_offline' }, { v: 1, kind: 'nope' }, { v: 1, kind: 'ws_offline', closeCode: 999 },
    { v: 1, kind: 'ws_offline', offlineMs: -1 }, { v: 1, kind: 'ws_offline', closeReason: 'x'.repeat(41) },
    { v: 1, kind: 'ws_offline', ua: 'Mozilla/5.0' }, { v: 1, kind: 'ws_offline', app: 'bad app!' },
    { v: 1, kind: 'ws_offline', phase: 'x' }, { v: 1, kind: 'ws_offline', online: 'yes' },
  ])('rejects %j', (body) => {
    expect(o().clientReport(body)).toBe(false);
  });
});

describe('readRevision', () => {
  it('prefers env and never throws', () => {
    expect(readRevision('abc123')).toBe('abc123');
    expect(readRevision(undefined, '/nonexistent/.git')).toBe('unknown');
  });
});
