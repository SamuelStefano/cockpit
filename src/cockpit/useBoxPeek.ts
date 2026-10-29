import { useEffect, useState } from 'react';
import { loadPref } from '../lib/persist';
import { BoxPeek, IDLE_PEEK, peekUrl, type PeekSocket, type PeekState } from './box-peek';
import { pinnedAgents } from './device-store';
import { SealedSocket } from './sealed-socket';
import { wsBase } from './session';

const dial = (box: string): PeekSocket =>
  new SealedSocket(peekUrl(wsBase(), box), loadPref<string>('auth.token', ''), { box, peek: true });
const isEnrolled = async (box: string) => (await pinnedAgents(box)).length > 0;

export function useBoxPeek(box: string, enabled: boolean): PeekState {
  const [state, setState] = useState<PeekState>(IDLE_PEEK);
  useEffect(() => {
    if (!enabled) { setState(IDLE_PEEK); return; }
    const peek = new BoxPeek(box, { dial, isEnrolled, onChange: setState });
    return () => peek.dispose();
  }, [box, enabled]);
  return state;
}
