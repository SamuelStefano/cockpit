import { describe, expect, it } from 'vitest';
import {
  applyAnswer, applyMinutes, failMeeting, minutesPrompt, newMeeting, nextStep, round1Prompt, round2Prompt,
  validateMeetingInput, visibleMeeting, type TeamMeeting,
} from './team-meeting';

const team = [
  { id: 'a1', name: 'Ana' }, { id: 'b2', name: 'Beto' }, { id: 'c3', name: 'Caio' },
  { id: 'g7', name: 'Grok', model: 'agent:grok' },
];
const nameOf = (id: string) => team.find((b) => b.id === id)?.name ?? id;
const base = () => newMeeting('m1', { question: 'Migrar?', participantIds: ['a1', 'b2'], moderatorId: 'c3' }, 1);

describe('validateMeetingInput', () => {
  const ok = { question: ' Migrar? ', participantIds: ['a1', 'b2'], moderatorId: 'c3' };
  it('accepts and trims', () => {
    expect(validateMeetingInput(ok, team)).toEqual({ ok: true, input: { question: 'Migrar?', participantIds: ['a1', 'b2'], moderatorId: 'c3' } });
  });
  it.each([
    ['empty question', { ...ok, question: '  ' }],
    ['long question', { ...ok, question: 'x'.repeat(601) }],
    ['one participant', { ...ok, participantIds: ['a1'] }],
    ['seven participants', { ...ok, participantIds: ['a1', 'b2', 'c3', 'a1', 'b2', 'c3', 'x'] }],
    ['duplicate participant', { ...ok, participantIds: ['a1', 'a1'] }],
    ['unknown participant', { ...ok, participantIds: ['a1', 'zz'] }],
    ['unknown moderator', { ...ok, moderatorId: 'zz' }],
    ['missing moderator', { ...ok, moderatorId: undefined }],
    ['external agent participant', { ...ok, participantIds: ['a1', 'g7'] }],
    ['external agent moderator', { ...ok, moderatorId: 'g7' }],
    ['non-array participants', { ...ok, participantIds: 'a1' }],
    ['null', null],
  ])('rejects %s', (_n, raw) => {
    expect(validateMeetingInput(raw, team).ok).toBe(false);
  });
  it('names the external agent in Portuguese', () => {
    const r = validateMeetingInput({ ...ok, participantIds: ['a1', 'g7'] }, team);
    expect(r).toEqual({ ok: false, error: 'Grok usa um agente externo e não participa de reuniões' });
  });
});

describe('nextStep / applyAnswer', () => {
  it('walks round 1 in order, then round 2, then minutes, then done', () => {
    let m = base();
    expect(nextStep(m)).toEqual({ kind: 'answer', botId: 'a1', round: 1 });
    m = applyAnswer(m, 'a1', 1, 'one', 2);
    expect(m.status).toBe('round1');
    expect(nextStep(m)).toEqual({ kind: 'answer', botId: 'b2', round: 1 });
    m = applyAnswer(m, 'b2', 1, 'two', 3);
    expect(m.status).toBe('round2');
    expect(nextStep(m)).toEqual({ kind: 'answer', botId: 'a1', round: 2 });
    m = applyAnswer(applyAnswer(m, 'a1', 2, 'x', 4), 'b2', 2, 'y', 5);
    expect(m.status).toBe('minutes');
    expect(nextStep(m)).toEqual({ kind: 'minutes', botId: 'c3' });
    m = applyMinutes(m, 'ata', 6);
    expect(m.status).toBe('done');
    expect(nextStep(m)).toEqual({ kind: 'none' });
  });
  it('trims answers to 1500 and minutes to 3000', () => {
    const m = applyAnswer(base(), 'a1', 1, `  ${'x'.repeat(2000)}`, 2);
    expect(m.answers[0].text).toHaveLength(1500);
    expect(applyMinutes(m, 'y'.repeat(4000), 3).minutes).toHaveLength(3000);
  });
  it('ignores a duplicate answer and a stranger', () => {
    const m = applyAnswer(base(), 'a1', 1, 'one', 2);
    expect(applyAnswer(m, 'a1', 1, 'again', 3)).toBe(m);
    expect(applyAnswer(m, 'c3', 1, 'hi', 3)).toBe(m);
  });
  it('failed has no next step and keeps answers', () => {
    const m = failMeeting(applyAnswer(base(), 'a1', 1, 'one', 2), 'x'.repeat(500), 3);
    expect(m.status).toBe('failed');
    expect(m.answers).toHaveLength(1);
    expect(m.error).toHaveLength(200);
    expect(nextStep(m)).toEqual({ kind: 'none' });
  });
});

describe('visibleMeeting', () => {
  it('blanks round-1 text while round 1 is open, keeping the delivery marker', () => {
    const m = applyAnswer(base(), 'a1', 1, 'secret', 2);
    const v = visibleMeeting(m);
    expect(v.answers).toEqual([{ botId: 'a1', round: 1, text: '', at: 2 }]);
    expect(JSON.stringify(v)).not.toContain('secret');
    expect(m.answers[0].text).toBe('secret');
  });
  it('reveals round 1 once round 2 opens', () => {
    const m = applyAnswer(applyAnswer(base(), 'a1', 1, 'secret', 2), 'b2', 1, 'other', 3);
    expect(visibleMeeting(m).answers.map((a) => a.text)).toEqual(['secret', 'other']);
  });
});

describe('prompts', () => {
  it('round 1 is blind, short and ends with Recomendo', () => {
    const p = round1Prompt('Migrar?');
    expect(p).toContain('Migrar?');
    expect(p).toContain('NÃO vê');
    expect(p).toContain('8 linhas');
    expect(p).toContain('"Recomendo: ..."');
  });
  it('round 2 shows own and others by name', () => {
    const p = round2Prompt('Migrar?', 'minha', [{ botId: 'b2', text: 'dele' }], nameOf);
    expect(p).toContain('minha');
    expect(p).toContain('Beto:\ndele');
    expect(p).toContain('6 linhas');
    expect(p).toContain('"Recomendo: ..."');
  });
  it('minutes asks for the four sections', () => {
    const p = minutesPrompt('Migrar?', [
      { botId: 'a1', round: 1, text: 'r1a', at: 1 }, { botId: 'a1', round: 2, text: 'r2a', at: 2 },
    ] as TeamMeeting['answers'], nameOf);
    for (const s of ['Decisão recomendada', 'Onde concordam', 'Onde discordam', 'O que o humano precisa decidir', 'Ana:\nr1a', 'Ana:\nr2a']) expect(p).toContain(s);
  });
});
