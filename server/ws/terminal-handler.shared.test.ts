import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';

const terms = vi.hoisted(() => ({
  openTerm: vi.fn((_id: string, _c: number, _r: number, _d: unknown, _e: unknown, onReplay: (d: string) => void) => { onReplay('first paint'); return true; }),
  detachTerm: vi.fn(), inputTerm: vi.fn(), resizeTerm: vi.fn(), closeTerm: vi.fn(),
  listTerms: vi.fn(async () => []), resumeTerm: vi.fn(async () => true), ensureWatchReaper: vi.fn(), prepareWatch: vi.fn(async () => {}),
  termSnapshot: vi.fn(() => 'screen now'),
}));
vi.mock('../terminals', () => terms);
const bc = vi.hoisted(() => ({ send: vi.fn(), BACKPRESSURE_BYTES: 1_000_000 }));
vi.mock('./broadcast', () => bc);

import { handleTerm, type TermHandle } from './terminal-handler';

const ws = { OPEN: 1, readyState: 1, bufferedAmount: 0 } as unknown as WebSocket;
const open = { t: 'term-open', termId: 'main', cols: 80, rows: 24 } as const;
const replays = () => bc.send.mock.calls.filter((c) => (c[1] as { t: string }).t === 'term-replay');

describe('terminal handler on the relay agent (one socket for every tab)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('a tab reopening an attached terminal still gets its screen repainted', () => {
    const my = new Map<string, TermHandle>();
    handleTerm(ws, open as never, my, true);
    handleTerm(ws, open as never, my, true);
    expect(terms.openTerm).toHaveBeenCalledOnce();
    expect(replays().map((c) => (c[1] as { data: string }).data)).toEqual(['first paint', 'screen now']);
  });

  it("one tab's detach does not cut the other tabs off", () => {
    const my = new Map<string, TermHandle>();
    handleTerm(ws, open as never, my, true);
    handleTerm(ws, { t: 'term-detach', termId: 'main' } as never, my, true);
    expect(terms.detachTerm).not.toHaveBeenCalled();
    expect(my.has('main')).toBe(true);
  });

  it('a per-tab socket (listen mode) still detaches', () => {
    const my = new Map<string, TermHandle>();
    handleTerm(ws, open as never, my);
    handleTerm(ws, { t: 'term-detach', termId: 'main' } as never, my);
    expect(terms.detachTerm).toHaveBeenCalledOnce();
  });
});
