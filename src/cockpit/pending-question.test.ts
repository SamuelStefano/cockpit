import { describe, it, expect } from 'vitest';
import { pendingQuestionIdx, clampToPendingQuestion } from './pending-question';
import type { Message } from '../data/mock';

const qBlock = { type: 'tool' as const, tool: { id: 'q', name: 'AskUserQuestion', label: 'x', command: '', status: 'done' as const, output: [], questions: [{ question: 'Q?', header: 'H', multiSelect: false, options: [{ label: 'A' }] }] } };
const txt = (md: string) => ({ type: 'text' as const, md });
const user = (id: string): Message => ({ id, role: 'user', text: 'oi' });
const asstQ = (id: string, after = false): Message => ({ id, role: 'assistant', blocks: after ? [txt('antes'), qBlock, txt('continuacao no mesmo balao')] : [txt('antes'), qBlock] });
const asst = (id: string): Message => ({ id, role: 'assistant', blocks: [txt('continuacao em balao separado')] });

describe('pendingQuestionIdx', () => {
  it('acha a pergunta após o último user', () => {
    expect(pendingQuestionIdx([user('u1'), asstQ('a1')])).toBe(1);
  });
  it('-1 quando o usuário já respondeu (user após a pergunta)', () => {
    expect(pendingQuestionIdx([user('u1'), asstQ('a1'), user('u2'), asst('a2')])).toBe(-1);
  });
  it('-1 quando não há pergunta', () => {
    expect(pendingQuestionIdx([user('u1'), asst('a1')])).toBe(-1);
  });
  it('acha a pergunta mesmo com continuação vazada num balão posterior', () => {
    // Continuação auto-resolvida vaza pra uma bolha nova: a pergunta NÃO é mais a
    // última msg crua, mas segue pendente. O gate da fila/card não pode perdê-la.
    expect(pendingQuestionIdx([user('u1'), asstQ('a1'), asst('a2')])).toBe(1);
  });
});

describe('clampToPendingQuestion', () => {
  it('corta balões de continuação após a pergunta (caso reload)', () => {
    const out = clampToPendingQuestion([user('u1'), asstQ('a1'), asst('a2'), asst('a3')]);
    expect(out.map((m) => m.id)).toEqual(['u1', 'a1']);
  });
  it('corta blocos após o bloco da pergunta no MESMO balão (caso ao vivo)', () => {
    const out = clampToPendingQuestion([user('u1'), asstQ('a1', true)]);
    const last = out[out.length - 1];
    expect(last.role === 'assistant' && last.blocks.length).toBe(2);
    expect(last.role === 'assistant' && last.blocks.some((b) => b.type === 'text' && b.md.includes('continuacao'))).toBe(false);
  });
  it('intacto quando respondida ou sem pergunta', () => {
    const answered = [user('u1'), asstQ('a1'), user('u2'), asst('a2')];
    expect(clampToPendingQuestion(answered)).toBe(answered);
    const none = [user('u1'), asst('a1')];
    expect(clampToPendingQuestion(none)).toBe(none);
  });
});
