import { loadPref } from '../lib/persist';
import { peekUrl, type PeekSocket } from './box-peek';
import { pinnedAgents } from './device-store';
import { SealedSocket } from './sealed-socket';
import { wsBase } from './session';

export const dial = (box: string): PeekSocket =>
  new SealedSocket(peekUrl(wsBase(), box), loadPref<string>('auth.token', ''), { box, peek: true });
export const isEnrolled = async (box: string) => (await pinnedAgents(box)).length > 0;
