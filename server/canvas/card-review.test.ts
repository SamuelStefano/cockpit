import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cardMarker, type CanvasCard } from '../../shared/canvas';

// cardIdFromRefsCache (server/canvas/index.ts) reads ~/.cockpit/canvas-refs.json
// by default — a real, potentially large file on a dev box. Point it at a
// guaranteed-empty tmp path BEFORE the module-level cache is ever populated
// (it's memoized for the process), so every lookup here is hermetic and cheap.
process.env.COCKPIT_CANVAS_REFS = join(mkdtempSync(join(tmpdir(), 'canvas-refs-')), 'refs.json');

import { __resetCardSessions } from './card-sessions';
import { resolveTurnCardId, shouldMoveToReview } from './card-review';

describe('resolveTurnCardId', () => {
  beforeEach(() => __resetCardSessions());

  it('reads the marker straight off the turn prompt (launch turn)', async () => {
    expect(await resolveTurnCardId({ prompt: `faz isso ${cardMarker('abcd-1234')}`, sessionId: 's1' })).toBe('abcd-1234');
  });

  it('last marker wins when the prompt carries more than one (priority-interrupt carry-over quotes the old prompt)', async () => {
    const prompt = `Você estava no meio de: roda ${cardMarker('old-card')}\n\nNOVA INSTRUÇÃO URGENTE: roda ${cardMarker('new-card')}`;
    expect(await resolveTurnCardId({ prompt, sessionId: 's1' })).toBe('new-card');
  });

  it('falls back to the disk refs cache (which misses here) when unbound', async () => {
    expect(await resolveTurnCardId({ prompt: 'sem marcador nenhum', sessionId: 'never-seen-session' })).toBeUndefined();
  });

  it('falls back to nothing when the turn has no sessionId at all (never calls cardIdForSession/refs cache with undefined)', async () => {
    expect(await resolveTurnCardId({ prompt: 'sem marcador nenhum', sessionId: undefined })).toBeUndefined();
  });
});

describe('shouldMoveToReview', () => {
  it('moves a doing card whose turn closed ok', () => {
    expect(shouldMoveToReview(true, 'card-1', 'doing')).toBe('card-1');
  });

  it('leaves it alone when the turn did not finish cleanly, there is no card, or it is not doing', () => {
    expect(shouldMoveToReview(false, 'card-1', 'doing')).toBeUndefined();
    expect(shouldMoveToReview(true, undefined, 'doing')).toBeUndefined();
    expect(shouldMoveToReview(true, 'card-1', 'review')).toBeUndefined();
    expect(shouldMoveToReview(true, 'card-1', 'todo')).toBeUndefined();
    expect(shouldMoveToReview(true, 'card-1', undefined)).toBeUndefined();
  });
});

// The listener itself (registered once, at this file's import time) — exercised
// end to end against a real temp board file, with broadcast mocked so the test
// can assert the frame without a live WebSocketServer. Static imports on
// purpose: the module-level `onTurnClosed` subscription only needs to happen
// once for the whole file, and a fresh board file per test (beforeEach) is
// enough isolation between cases. Session ids are unique per test so
// card-sessions.ts's in-memory session→card map (also a process singleton)
// never leaks between them.
vi.mock('../ws/broadcast', () => ({ broadcast: vi.fn() }));
import { broadcast } from '../ws/broadcast';
import * as boardModule from './board';
import { readBoard, updateBoard } from './board';
import { emitTurnClosed } from './turn-hooks';

const card = (over: Partial<CanvasCard> = {}): CanvasCard => ({
  id: 'card-1', title: 't', prompt: 'p', status: 'doing', kind: 'task',
  contextIds: [], sessionIds: [], createdAt: 1, updatedAt: 1, ...over,
});
// hop/unattended: fields runs.ts's isCleanTurnClose-era emission always
// carries now; irrelevant to card-review's own decision, so a fixed stub.
const turn = (over: Partial<Parameters<typeof emitTurnClosed>[0]>) =>
  emitTurnClosed({ sessionKey: 'k', prompt: '', text: '', params: {}, ok: true, hop: 0, unattended: false, ...over });

describe('onTurnClosed listener', () => {
  beforeEach(async () => {
    process.env.COCKPIT_CANVAS_BOARD = join(mkdtempSync(join(tmpdir(), 'canvas-review-')), 'b.json');
    vi.clearAllMocks();
    await updateBoard((b) => ({ ...b, cards: [card()] }));
  });
  afterEach(() => { vi.clearAllMocks(); });

  it('moves the card to review and broadcasts a slim card-status frame on a successful marked turn', async () => {
    turn({ sessionId: 'sess-a', prompt: `roda ${cardMarker('card-1')}`, text: 'ok', ok: true });

    await vi.waitFor(() => expect(broadcast).toHaveBeenCalledWith({ t: 'canvas-card-status', cardId: 'card-1', status: 'review' }));
    expect((await readBoard()).cards[0].status).toBe('review');
  });

  it('moves a FOLLOW-UP turn (no marker in its own prompt) using the remembered session→card binding', async () => {
    // The launch turn carries the marker but gets stopped (a question, a stop) —
    // the card stays "doing", the binding is remembered regardless.
    turn({ sessionId: 'sess-b', prompt: `roda ${cardMarker('card-1')}`, text: '', ok: false });
    await new Promise((r) => setTimeout(r, 20));
    expect((await readBoard()).cards[0].status).toBe('doing');

    // The user's next message (no marker at all) closes cleanly — the card
    // still moves, because the session was already remembered as card-1's.
    turn({ sessionId: 'sess-b', prompt: 'continua', text: 'ok', ok: true });
    await vi.waitFor(() => expect(broadcast).toHaveBeenCalledWith({ t: 'canvas-card-status', cardId: 'card-1', status: 'review' }));
    expect((await readBoard()).cards[0].status).toBe('review');
  });

  it('does not touch the board or broadcast on a stopped turn', async () => {
    turn({ sessionId: 'sess-c', prompt: `roda ${cardMarker('card-1')}`, text: '', ok: false });
    await new Promise((r) => setTimeout(r, 20));

    expect(broadcast).not.toHaveBeenCalled();
    expect((await readBoard()).cards[0].status).toBe('doing');
  });

  // canvas review #593 third pass item 5: shouldMoveToReview always says no
  // for ok=false — the card lookup (async disk fallback on a cache miss) and
  // the board read are skipped entirely rather than done and thrown away.
  it('skips the card lookup and board read entirely when ok=false', async () => {
    const readSpy = vi.spyOn(boardModule, 'readBoardChained');
    turn({ sessionId: 'sess-f', prompt: `roda ${cardMarker('card-1')}`, text: '', ok: false });
    await new Promise((r) => setTimeout(r, 20));
    expect(readSpy).not.toHaveBeenCalled();
    readSpy.mockRestore();
  });

  it('does not touch the board or broadcast when the prompt carries no marker and the session is unknown', async () => {
    turn({ sessionId: 'sess-d', prompt: 'sem marcador nenhum', text: 'ok', ok: true });
    await new Promise((r) => setTimeout(r, 20));

    expect(broadcast).not.toHaveBeenCalled();
    expect((await readBoard()).cards[0].status).toBe('doing');
  });

  it('a card already in review is a no-op (nothing changed, nothing broadcast)', async () => {
    await updateBoard((b) => ({ ...b, cards: [card({ status: 'review' })] }));
    turn({ sessionId: 'sess-e', prompt: `roda ${cardMarker('card-1')}`, text: 'ok', ok: true });
    await new Promise((r) => setTimeout(r, 20));

    expect(broadcast).not.toHaveBeenCalled();
  });
});
