import { describe, it, expect } from 'vitest';
import { chatTopics, topicTitle, activeTopicIndex, TOPIC_TITLE_MAX } from './chat-topics';
import type { Message } from '../../data/types';

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
