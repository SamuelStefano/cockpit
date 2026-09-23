import { describe, expect, it, vi } from 'vitest';
import { emitTurnClosed, onTurnClosed, type TurnClosed } from './turn-hooks';

const turn: TurnClosed = { sessionKey: 'k', prompt: 'p', text: 't', params: {}, ok: true, hop: 0, unattended: false };

describe('turn hooks', () => {
  it('calls every listener and survives one that throws', () => {
    const bad = onTurnClosed(() => { throw new Error('boom'); });
    const good = vi.fn();
    const off = onTurnClosed(good);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    emitTurnClosed(turn);
    expect(good).toHaveBeenCalledWith(turn);
    off(); bad(); err.mockRestore();
  });

  it('stops calling a listener after unsubscribe', () => {
    const fn = vi.fn();
    onTurnClosed(fn)();
    emitTurnClosed(turn);
    expect(fn).not.toHaveBeenCalled();
  });
});
