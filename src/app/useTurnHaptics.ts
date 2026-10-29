import { useEffect, useRef } from 'react';
import { haptic } from '../lib/haptics';

// Send = the phase leaves idle; done = the Bit's "just finished" moment.
export function useTurnHaptics(phase: 'idle' | 'thinking' | 'streaming', justDone: boolean): void {
  const prev = useRef(phase);
  useEffect(() => {
    if (prev.current === 'idle' && phase !== 'idle') haptic('tap');
    prev.current = phase;
  }, [phase]);
  useEffect(() => { if (justDone) haptic('done'); }, [justDone]);
}
