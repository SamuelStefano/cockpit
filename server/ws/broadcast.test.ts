import { describe, it, expect, beforeEach } from 'vitest';
import type { WebSocketServer, WebSocket } from 'ws';
import type { ServerMsg } from '../../shared/protocol';
import { broadcast, send, setWss } from './broadcast';

const OPEN = 1;
const CLOSED = 3;
const OVER = 5 * 1024 * 1024; // above the 4 MiB backpressure cap

type FakeClient = { readyState: number; OPEN: number; bufferedAmount: number; sent: string[]; send: (s: string) => void };

function client(readyState: number, bufferedAmount = 0): FakeClient {
  const sent: string[] = [];
  return { readyState, OPEN, bufferedAmount, sent, send: (s) => sent.push(s) };
}

function wssWith(clients: FakeClient[]) {
  setWss({ clients: new Set(clients) } as unknown as WebSocketServer);
}

const delta = { t: 'delta' } as unknown as ServerMsg; // droppable under backpressure
const done = { t: 'done' } as unknown as ServerMsg; // lifecycle, never dropped

describe('broadcast', () => {
  beforeEach(() => setWss(null));

  it('is a no-op when no server is registered', () => {
    expect(() => broadcast(delta)).not.toThrow();
  });

  it('sends to every open client', () => {
    const a = client(OPEN), b = client(OPEN);
    wssWith([a, b]);
    broadcast(done);
    expect(a.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(1);
  });

  it('skips clients that are not open', () => {
    const closed = client(CLOSED);
    wssWith([closed]);
    broadcast(done);
    expect(closed.sent).toHaveLength(0);
  });

  it('drops droppable frames for a backpressured client', () => {
    const slow = client(OPEN, OVER);
    wssWith([slow]);
    broadcast(delta);
    expect(slow.sent).toHaveLength(0);
  });

  it('still delivers lifecycle frames to a backpressured client', () => {
    const slow = client(OPEN, OVER);
    wssWith([slow]);
    broadcast(done);
    expect(slow.sent).toHaveLength(1);
  });

  it('only drops for the backpressured client, not healthy peers', () => {
    const slow = client(OPEN, OVER), fast = client(OPEN, 0);
    wssWith([slow, fast]);
    broadcast(delta);
    expect(slow.sent).toHaveLength(0);
    expect(fast.sent).toHaveLength(1);
  });
});

describe('send', () => {
  it('sends to an open socket', () => {
    const c = client(OPEN);
    send(c as unknown as WebSocket, done);
    expect(c.sent).toHaveLength(1);
  });

  it('does not send to a closed socket', () => {
    const c = client(CLOSED);
    send(c as unknown as WebSocket, done);
    expect(c.sent).toHaveLength(0);
  });
});
