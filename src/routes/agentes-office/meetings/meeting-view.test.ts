import { describe, expect, it } from 'vitest';
import type { TeamBot } from '../../../../shared/protocol';
import { applyAnswer, newMeeting } from '../../../../shared/team-meeting';
import { botBlock, defaultModeratorId, formBlock, seatState, submitBlock } from './meeting-view';

const bot = (id: string, over: Partial<TeamBot> = {}): TeamBot => ({ id, name: id, label: '', instructions: '', mascot: { shape: 'drop', color: '#fff' }, profile: 'restricted', createdAt: 0, updatedAt: 0, ...over });
const base = newMeeting('m1', { question: 'q', participantIds: ['a', 'b'], moderatorId: 'a' }, 1);

describe('seatState', () => {
  it('seals a delivered round-1 answer and shows the other as writing', () => {
    const m = applyAnswer(base, 'a', 1, 'x', 2);
    expect(seatState(m, 'a', 1)).toBe('sealed');
    expect(seatState(m, 'b', 1)).toBe('writing');
    expect(seatState(m, 'a', 2)).toBe('waiting');
  });
  it('shows round 1 once round 2 opens', () => {
    const m = applyAnswer(applyAnswer(base, 'a', 1, 'x', 2), 'b', 1, 'y', 3);
    expect(m.status).toBe('round2');
    expect(seatState(m, 'a', 1)).toBe('shown');
    expect(seatState(m, 'a', 2)).toBe('writing');
  });
});

describe('form guards', () => {
  it('picks the primary bot, else the first', () => {
    expect(defaultModeratorId([bot('a'), bot('b', { primary: true })])).toBe('b');
    expect(defaultModeratorId([bot('a'), bot('b')])).toBe('a');
    expect(defaultModeratorId([])).toBe('');
  });
  it('blocks external agents', () => {
    expect(botBlock(bot('a', { model: 'agent:grok' }))).toMatch(/externo/);
    expect(botBlock(bot('a', { model: 'opus' }))).toBeNull();
  });
  it('blocks non-admins and teams too small', () => {
    expect(formBlock(false, [bot('a'), bot('b')])).toBe('Só o admin abre reuniões');
    expect(formBlock(true, [bot('a'), bot('b', { model: 'agent:x' })])).toMatch(/pelo menos 2/);
    expect(formBlock(true, [bot('a'), bot('b')])).toBeNull();
  });
  it('requires a question and 2 to 6 picks', () => {
    expect(submitBlock(' ', 3)).toBe('Escreva a pergunta');
    expect(submitBlock('q', 1)).toMatch(/pelo menos 2/);
    expect(submitBlock('q', 7)).toMatch(/No máximo 6/);
    expect(submitBlock('q', 2)).toBeNull();
  });
});
