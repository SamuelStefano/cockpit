import { describe, it, expect, vi } from 'vitest';
import { chatTopics, topicTitle, activeTopicIndex, TOPIC_TITLE_MAX, userBody } from './chat-topics';
import { parseAttachments } from '../../../shared/parse-attachments';

vi.mock('../../../shared/parse-attachments', async (orig) => {
  const mod = await orig<typeof import('../../../shared/parse-attachments')>();
  return { ...mod, parseAttachments: vi.fn(mod.parseAttachments) };
});
import type { Message, UserMessage } from '../../data/types';

const user = (id: string, text: string): Message => ({ id, role: 'user', text, ts: 1 });
const bot = (id: string): Message => ({ id, role: 'assistant', blocks: [{ type: 'text', md: 'ok' }] });

describe('topicTitle', () => {
  it('uses the first non-empty line, collapsing whitespace', () => {
    expect(topicTitle('\n\n  Me ajude   a achar vagas\nmais detalhes')).toBe('Me ajude a achar vagas');
  });

  it('strips markdown prefixes', () => {
    expect(topicTitle('## Vagas dev junior')).toBe('Vagas dev junior');
  });

  it('cuts long prompts at a word boundary with an ellipsis', () => {
    const t = topicTitle('Me ajude a achar vagas APENAS para dev junior em Full stack, Frontend e Backend no Brasil');
    expect(t.length).toBeLessThanOrEqual(TOPIC_TITLE_MAX + 1);
    expect(t.endsWith('…')).toBe(true);
    expect(t).not.toMatch(/\s…$/);
  });
});

describe('chatTopics', () => {
  it('one topic per user prompt, in thread order', () => {
    const topics = chatTopics([user('u1', 'vagas dev junior'), bot('a1'), user('u2', 'sobre mim'), bot('a2'), user('u3', 'influência do inglês')]);
    expect(topics.map((t) => [t.id, t.title])).toEqual([['u1', 'vagas dev junior'], ['u2', 'sobre mim'], ['u3', 'influência do inglês']]);
  });

  it('skips prompts with no visible text', () => {
    expect(chatTopics([user('u1', '   \n  ')])).toEqual([]);
  });
});

describe('activeTopicIndex', () => {
  it('picks the last topic whose top crossed the read line', () => {
    const tops = [0, 500, 1200];
    expect(activeTopicIndex(tops, 0)).toBe(0);
    expect(activeTopicIndex(tops, 450)).toBe(1);
    expect(activeTopicIndex(tops, 1150)).toBe(2);
  });
});

describe('chatTopics / userBody cache', () => {
  it('parses a user message once across streamed deltas', () => {
    const spy = vi.mocked(parseAttachments);
    const user = { id: 'u1', role: 'user', text: 'first prompt' } as UserMessage;
    const reply = (t: string) => ({ id: 'a1', role: 'assistant', blocks: [{ type: 'text', md: t }] }) as unknown as Message;
    chatTopics([user, reply('a')]);
    userBody(user);
    const calls = spy.mock.calls.length;
    chatTopics([user, reply('ab')]);
    chatTopics([user, reply('abc')]);
    userBody(user);
    expect(spy.mock.calls.length).toBe(calls);
  });

  it('re-parses a message edited in place', () => {
    const user = { id: 'u2', role: 'user', text: 'old title' } as UserMessage;
    expect(chatTopics([user])[0].title).toBe('old title');
    user.text = 'new title';
    expect(chatTopics([user])[0].title).toBe('new title');
    expect(userBody(user)).toBe('new title');
  });
});
