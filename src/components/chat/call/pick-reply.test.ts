import { describe, expect, it } from 'vitest';
import type { Message } from '../../../data/types';
import { pickSpokenReply } from './pick-reply';

const user = (id: string): Message => ({ id, role: 'user', text: 'oi' });
const bot = (id: string, md: string, extra: Partial<Extract<Message, { role: 'assistant' }>> = {}): Message =>
  ({ id, role: 'assistant', blocks: [{ type: 'text', md }], ...extra });

describe('pickSpokenReply', () => {
  it('returns the latest answer after the last user message', () => {
    expect(pickSpokenReply([user('u1'), bot('a1', 'Primeira.'), bot('a2', 'Segunda.')])).toEqual({ id: 'a2', text: 'Segunda.' });
  });
  it('never reads an answer that belongs to an older turn', () => {
    expect(pickSpokenReply([user('u1'), bot('a1', 'Velha.'), user('u2')])).toBeNull();
  });
  it('skips error and notice bubbles', () => {
    const msgs = [user('u1'), bot('a1', 'Boa.'), bot('a2', 'Falhou', { error: true }), bot('a3', 'Offline', { notice: true })];
    expect(pickSpokenReply(msgs)).toEqual({ id: 'a1', text: 'Boa.' });
  });
  it('skips assistant messages with nothing speakable', () => {
    const code: Message = { id: 'a2', role: 'assistant', blocks: [{ type: 'code', lang: 'ts', code: 'x' }] };
    expect(pickSpokenReply([user('u1'), bot('a1', 'Texto.'), code])).toEqual({ id: 'a1', text: 'Texto.' });
  });
  it('handles an empty thread', () => {
    expect(pickSpokenReply([])).toBeNull();
  });
});
