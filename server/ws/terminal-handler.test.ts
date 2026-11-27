import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';

const term = vi.hoisted(() => ({
  openTerm: vi.fn(() => true),
  detachTerm: vi.fn(),
  inputTerm: vi.fn(),
  resizeTerm: vi.fn(),
  closeTerm: vi.fn(),
  listTerms: vi.fn(async () => ['a', 'b']),
  resumeTerm: vi.fn(async () => true),
  ensureWatchReaper: vi.fn(),
  prepareWatch: vi.fn(async () => {}),
}));
const sent = vi.hoisted(() => ({ fn: vi.fn() }));

vi.mock('../terminals', () => term);
vi.mock('./broadcast', () => ({ send: sent.fn }));

import { handleTerm, type TermHandle } from './terminal-handler';

const ws = {} as WebSocket;
function run(msg: ClientMsg, myTerms = new Map<string, TermHandle>()) {
  return { handled: handleTerm(ws, msg, myTerms), myTerms };
}

beforeEach(() => {
  vi.clearAllMocks();
  term.openTerm.mockReturnValue(true);
});

describe('handleTerm routing', () => {
  it('returns false for non-terminal messages so they fall through to authz/dispatch', () => {
    for (const t of ['send', 'list', 'open', 'purge', 'upload-chunk'] as const) {
      expect(handleTerm(ws, { t } as ClientMsg, new Map())).toBe(false);
    }
    expect(term.openTerm).not.toHaveBeenCalled();
  });

  it('returns true for every term-* message (claims it from the dispatcher)', () => {
    expect(run({ t: 'term-open', termId: 'x', cols: 80, rows: 24 }).handled).toBe(true);
    expect(run({ t: 'term-input', termId: 'x', data: 'ls' }).handled).toBe(true);
    expect(run({ t: 'term-resize', termId: 'x', cols: 80, rows: 24 }).handled).toBe(true);
    expect(run({ t: 'term-detach', termId: 'x' }).handled).toBe(true);
    expect(run({ t: 'term-close', termId: 'x' }).handled).toBe(true);
    expect(run({ t: 'term-list' }).handled).toBe(true);
    expect(run({ t: 'term-resume', termId: 'w-x', watch: 'u' }).handled).toBe(true);
  });
});

describe('term-resume', () => {
  it('tells the user when the pane is no longer just following', async () => {
    term.resumeTerm.mockResolvedValueOnce(false);
    run({ t: 'term-resume', termId: 'w-x', watch: 'u' });
    await vi.waitFor(() => expect(sent.fn).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'term-data', termId: 'w-x' })));
  });

  it('stays silent when the resume went through', async () => {
    run({ t: 'term-resume', termId: 'w-x', watch: 'u' });
    await Promise.resolve();
    await Promise.resolve();
    expect(term.resumeTerm).toHaveBeenCalledWith('w-x', 'u');
    expect(sent.fn).not.toHaveBeenCalled();
  });
});

describe('term-open', () => {
  it('tracks the handle on success', () => {
    const { myTerms } = run({ t: 'term-open', termId: 'x', cols: 80, rows: 24 });
    expect(term.openTerm).toHaveBeenCalledOnce();
    expect(myTerms.has('x')).toBe(true);
  });

  it('is idempotent per connection — a second open for the same id is a no-op', () => {
    const myTerms = new Map<string, TermHandle>();
    run({ t: 'term-open', termId: 'x', cols: 80, rows: 24 }, myTerms);
    run({ t: 'term-open', termId: 'x', cols: 80, rows: 24 }, myTerms);
    expect(term.openTerm).toHaveBeenCalledOnce();
  });

  it('does not track the handle and signals exit when openTerm fails', () => {
    term.openTerm.mockReturnValue(false);
    const { myTerms } = run({ t: 'term-open', termId: 'x', cols: 80, rows: 24 });
    expect(myTerms.has('x')).toBe(false);
    expect(sent.fn).toHaveBeenCalledWith(ws, { t: 'term-exit', termId: 'x' });
  });
});

describe('term-input cap (DoS guard)', () => {
  it('forwards input at or below 64KB', () => {
    run({ t: 'term-input', termId: 'x', data: 'a'.repeat(65536) });
    expect(term.inputTerm).toHaveBeenCalledWith('x', 'a'.repeat(65536));
  });

  it('drops input larger than 64KB instead of writing it to the PTY', () => {
    run({ t: 'term-input', termId: 'x', data: 'a'.repeat(65537) });
    expect(term.inputTerm).not.toHaveBeenCalled();
  });

  it('ignores non-string data', () => {
    run({ t: 'term-input', termId: 'x', data: 123 as unknown as string });
    expect(term.inputTerm).not.toHaveBeenCalled();
  });
});

describe('term-detach vs term-close', () => {
  it('detach drops local tracking but never kills the tmux session', () => {
    const myTerms = new Map<string, TermHandle>();
    run({ t: 'term-open', termId: 'x', cols: 80, rows: 24 }, myTerms);
    run({ t: 'term-detach', termId: 'x' }, myTerms);
    expect(term.detachTerm).toHaveBeenCalledOnce();
    expect(term.closeTerm).not.toHaveBeenCalled();
    expect(myTerms.has('x')).toBe(false);
  });

  it('close detaches and kills the session', () => {
    const myTerms = new Map<string, TermHandle>();
    run({ t: 'term-open', termId: 'x', cols: 80, rows: 24 }, myTerms);
    run({ t: 'term-close', termId: 'x' }, myTerms);
    expect(term.closeTerm).toHaveBeenCalledWith('x');
    expect(myTerms.has('x')).toBe(false);
  });

  it('close kills the session even for an id not attached to this connection', () => {
    run({ t: 'term-close', termId: 'orphan' });
    expect(term.closeTerm).toHaveBeenCalledWith('orphan');
  });
});

describe('term-open with watch', () => {
  const live = { readyState: 1, OPEN: 1 } as unknown as WebSocket;
  const uuid = '55b717e4-4e61-4a4f-83f9-2d2a4cdea948';

  it('swaps a bare shell for the follower before attaching', async () => {
    const myTerms = new Map<string, TermHandle>();
    handleTerm(live, { t: 'term-open', termId: 'w-a', cols: 80, rows: 24, watch: uuid }, myTerms);
    expect(term.openTerm).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(term.openTerm).toHaveBeenCalled());
    expect(term.prepareWatch).toHaveBeenCalledWith('w-a', uuid);
    expect(term.openTerm.mock.calls[0]).toContain(uuid);
    expect(myTerms.has('w-a')).toBe(true);
  });

  it('drops the attach when the window detached meanwhile', async () => {
    const myTerms = new Map<string, TermHandle>();
    handleTerm(live, { t: 'term-open', termId: 'w-b', cols: 80, rows: 24, watch: uuid }, myTerms);
    handleTerm(live, { t: 'term-detach', termId: 'w-b' }, myTerms);
    await new Promise((r) => setTimeout(r, 10));
    expect(term.openTerm).not.toHaveBeenCalled();
    expect(myTerms.has('w-b')).toBe(false);
  });
});

describe('term-open with watch — pty spawn failure', () => {
  const live = { readyState: 1, OPEN: 1 } as unknown as WebSocket;
  const uuid = '55b717e4-4e61-4a4f-83f9-2d2a4cdea948';

  it('reports term-exit instead of rejecting when openTerm throws', async () => {
    term.openTerm.mockImplementation(() => { throw new Error('forkpty(3) failed'); });
    const rejections: unknown[] = [];
    const onRejection = (e: unknown) => { rejections.push(e); };
    process.on('unhandledRejection', onRejection);
    try {
      handleTerm(live, { t: 'term-open', termId: 'w-f', cols: 80, rows: 24, watch: uuid }, new Map());
      await vi.waitFor(() => expect(sent.fn).toHaveBeenCalledWith(live, { t: 'term-exit', termId: 'w-f' }));
      await new Promise((r) => setTimeout(r, 20));
      expect(rejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', onRejection);
    }
  });
});
