import { describe, it, expect } from 'vitest';
import type { Message } from '../../data/types';
import { isTeamPromptMessage, threadAnchors } from './team-thread';

const user = (text: string, ts?: number): Message => ({ id: text, role: 'user', text, ts } as Message);
const bot = (ts: number): Message => ({ id: `a${ts}`, role: 'assistant', blocks: [], ts } as Message);

describe('team thread helpers', () => {
  it('recognizes a delivered team prompt only on user turns', () => {
    expect(isTeamPromptMessage(user('[Mensagem de capo]\noi'))).toBe(true);
    expect(isTeamPromptMessage(user('oi'))).toBe(false);
  });

  it('anchors traffic on the visible, timed messages', () => {
    expect(threadAnchors([user('oi', 1), user('[Mensagem de capo]\noi', 2), bot(3), user('sem ts')])).toEqual([1, 3]);
  });
});
