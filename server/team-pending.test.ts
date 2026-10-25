import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearPendingQuestion, questionsIn, readPendingQuestions, setPendingQuestion } from './team-pending';

const ask = (question: string) => [
  { type: 'text', text: 'contexto' },
  { type: 'tool_use', name: 'AskUserQuestion', input: { questions: [{ question, header: '', options: [{ label: 'Aprovar' }, { label: 'Cortar' }] }] } },
];

describe('team-pending store', () => {
  beforeEach(() => { process.env.COCKPIT_TEAM_PENDING = join(mkdtempSync(join(tmpdir(), 'tp-')), 'team-pending.json'); });

  it('extracts the questions an assistant message asks', () => {
    expect(questionsIn(ask('O que faço?'))?.[0]).toMatchObject({ question: 'O que faço?', options: [{ label: 'Aprovar' }, { label: 'Cortar' }] });
    expect(questionsIn([{ type: 'text', text: 'oi' }])).toBeUndefined();
  });

  it('persists one open question per bot, on disk, and survives a fresh read', () => {
    const questions = questionsIn(ask('Primeira?'))!;
    setPendingQuestion({ botId: 'capo1', sessionKey: 'bot-capo1', questions, at: 1 });
    setPendingQuestion({ botId: 'lead1', sessionKey: 'bot-lead1', questions, at: 2 });
    setPendingQuestion({ botId: 'capo1', sessionKey: 'bot-capo1', questions: questionsIn(ask('Segunda?'))!, at: 3 });
    const list = readPendingQuestions();
    expect(list.map((p) => p.botId).sort()).toEqual(['capo1', 'lead1']);
    expect(list.find((p) => p.botId === 'capo1')?.questions[0].question).toBe('Segunda?');
  });

  it('clears only on a change and drops malformed rows', () => {
    setPendingQuestion({ botId: 'capo1', sessionKey: 'k', questions: questionsIn(ask('Q?'))!, at: 1 });
    expect(clearPendingQuestion('ghost1')).toBeNull();
    expect(clearPendingQuestion('capo1')).toEqual([]);
    writeFileSync(process.env.COCKPIT_TEAM_PENDING!, JSON.stringify([{ botId: '../x', sessionKey: 'k', at: 1, questions: [] }, 'junk']));
    expect(readPendingQuestions()).toEqual([]);
  });
});
