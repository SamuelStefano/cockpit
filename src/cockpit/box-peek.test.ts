// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { BoxPeek, parseSessions, peekUrl, type PeekSocket, type PeekState } from './box-peek';

const BOX = '11111111-1111-4111-8111-111111111111';

class FakeSock implements PeekSocket {
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  sent: string[] = [];
  closed = false;
  send(d: string) { this.sent.push(d); }
  close() { this.closed = true; }
  open() { this.onopen?.(new Event('open')); }
  frame(m: unknown) { this.onmessage?.({ data: JSON.stringify(m) } as MessageEvent); }
  drop() { this.onclose?.({ code: 4002 } as CloseEvent); }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function make(enrolled = true) {
  const socks: FakeSock[] = [];
  const states: PeekState[] = [];
  const peek = new BoxPeek(BOX, {
    isEnrolled: async () => enrolled,
    dial: () => { const s = new FakeSock(); socks.push(s); return s; },
    onChange: (s) => states.push(s),
  });
  return { peek, socks, states, last: () => states[states.length - 1] };
}

afterEach(() => { vi.useRealTimers(); });

describe('peekUrl', () => {
  it('adds the box and the peek flag', () => {
    const u = new URL(peekUrl('wss://relay.example/ws', BOX));
    expect(u.searchParams.get('box')).toBe(BOX);
    expect(u.searchParams.get('peek')).toBe('1');
  });
});

describe('parseSessions', () => {
  it('keeps well-formed rows newest first and drops the rest', () => {
    const out = parseSessions([{ id: 'a', title: 'A', mtime: 1 }, null, { title: 'no id' }, { id: 'b', title: 7, mtime: 5, waiting: true }]);
    expect(out.map((s) => [s.id, s.title, s.waiting])).toEqual([['b', '', true], ['a', 'A', false]]);
  });

  it('is empty for anything but an array', () => {
    expect(parseSessions({ id: 'a' })).toEqual([]);
  });
});

describe('BoxPeek', () => {
  it('never dials a box this device is not enrolled on', async () => {
    const { socks, last } = make(false);
    await tick();
    expect(socks).toHaveLength(0);
    expect(last().status).toBe('locked');
  });

  it('subscribes to the summary, asks for the list and keeps sessions and busy', async () => {
    const { socks, last } = make();
    await tick();
    socks[0].open();
    expect(socks[0].sent.map((s) => JSON.parse(s))).toEqual([{ t: 'subscribe', scope: 'summary' }, { t: 'list' }]);
    socks[0].frame({ t: 'sessions', items: [{ id: 's1', title: 'Uma', mtime: 3 }] });
    socks[0].frame({ t: 'busy', keys: ['s1', 9] });
    socks[0].frame({ t: 'delta', text: 'ignored' });
    expect(last()).toMatchObject({ status: 'open', busy: ['s1'] });
    expect(last().sessions.map((s) => s.id)).toEqual(['s1']);
  });

  it('redials with backoff after a drop and stops once disposed', async () => {
    vi.useFakeTimers();
    const { peek, socks, last } = make();
    await vi.advanceTimersByTimeAsync(0);
    socks[0].open();
    socks[0].drop();
    expect(last().status).toBe('connecting');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(socks).toHaveLength(2);
    peek.dispose();
    expect(socks[1].closed).toBe(true);
    socks[1].drop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(socks).toHaveLength(2);
  });
});
