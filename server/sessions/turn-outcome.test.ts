import { describe, it, expect, vi } from 'vitest';

const { setTurnOutcome } = vi.hoisted(() => ({ setTurnOutcome: vi.fn() }));
vi.mock('../db', () => ({ setTurnOutcome }));

import { emitTurnClosed } from '../canvas/turn-hooks';
import './turn-outcome';

const turn = (over: Partial<Parameters<typeof emitTurnClosed>[0]>) =>
  emitTurnClosed({ sessionKey: 'k', prompt: '', text: '', params: {}, ok: true, hop: 0, unattended: false, ...over });

describe('turn-outcome listener', () => {
  it('persists ok=true on a clean close', () => {
    setTurnOutcome.mockClear();
    turn({ sessionId: 's1', ok: true });
    expect(setTurnOutcome).toHaveBeenCalledWith('s1', true, expect.any(Number));
  });

  it('persists ok=false on a crashed/stopped/failed close — the whole point', () => {
    setTurnOutcome.mockClear();
    turn({ sessionId: 's1', ok: false });
    expect(setTurnOutcome).toHaveBeenCalledWith('s1', false, expect.any(Number));
  });

  it('skips a turn with no resolvable sessionId (never persisted anything)', () => {
    setTurnOutcome.mockClear();
    turn({ sessionId: undefined });
    expect(setTurnOutcome).not.toHaveBeenCalled();
  });
});
