import { useEffect, useRef, useState } from 'react';
import type { Message } from '../../data/types';
import type { BitState } from '../bit/bit-state';
import { turnBitState, liveTurnBlocks, DONE_HOLD_MS, type LinkState, type TurnPhase } from '../bit/turn-bit-state';

interface Args {
  conn?: LinkState;
  phase: TurnPhase;
  messages: Message[];
  waiting: boolean;
  failed: boolean;
  quotaPaused?: boolean;
}

export function useTurnBit({ conn, phase, messages, waiting, failed, quotaPaused }: Args): BitState {
  const [justDone, setJustDone] = useState(false);
  const prevPhase = useRef(phase);
  useEffect(() => {
    const ended = prevPhase.current !== 'idle' && phase === 'idle';
    prevPhase.current = phase;
    if (phase !== 'idle') { setJustDone(false); return; }
    if (!ended) return;
    setJustDone(true);
    const t = setTimeout(() => setJustDone(false), DONE_HOLD_MS);
    return () => clearTimeout(t);
  }, [phase]);
  return turnBitState({ conn, phase, blocks: liveTurnBlocks(messages), waiting, failed, quotaPaused, justDone });
}
