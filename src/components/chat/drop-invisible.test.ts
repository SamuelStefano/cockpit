import { describe, it, expect } from 'vitest';
import { dropInvisible } from './drop-invisible';
import type { Message, ToolCall } from '../../data/mock';

const tool = (extra?: Partial<ToolCall>): ToolCall =>
  ({ id: 't', name: 'Bash', label: 'Bash', command: 'ls', status: 'done', output: [], ...extra });

const toolMsg = (id: string, extra?: Partial<ToolCall>): Message =>
  ({ id, role: 'assistant', blocks: [{ type: 'tool', tool: tool(extra) }] });
const textMsg = (id: string): Message => ({ id, role: 'assistant', blocks: [{ type: 'text', md: 'oi' }] });
const user = (id: string): Message => ({ id, role: 'user', text: 'oi' });

describe('dropInvisible', () => {
  it('mantém tudo com ferramentas visíveis', () => {
    const msgs = [user('u1'), toolMsg('a1'), textMsg('a2')];
    expect(dropInvisible(msgs, true)).toEqual(msgs);
  });

  it('remove assistant só-de-tool com ferramentas ocultas', () => {
    const msgs = [user('u1'), toolMsg('a1'), textMsg('a2')];
    expect(dropInvisible(msgs, false).map((m) => m.id)).toEqual(['u1', 'a2']);
  });

  it('nunca remove a última mensagem (alvo do indicador de pensamento)', () => {
    const msgs = [user('u1'), toolMsg('a1')];
    expect(dropInvisible(msgs, false).map((m) => m.id)).toEqual(['u1', 'a1']);
  });

  it('não remove AskUserQuestion, mas lista de tarefas sai como tool comum', () => {
    const q = toolMsg('q1', { name: 'AskUserQuestion', questions: [{ question: 'q', header: 'h', multiSelect: false, options: [] }] });
    const t = toolMsg('t1', { todos: [{ content: 'x', status: 'pending' }] });
    const msgs = [q, t, textMsg('a1')];
    expect(dropInvisible(msgs, false).map((m) => m.id)).toEqual(['q1', 'a1']);
  });

  it('deixa divisores de PR adjacentes para o coalesce', () => {
    const msgs: Message[] = [
      { id: 'p1', role: 'compact', kind: 'pr', url: 'https://a' },
      toolMsg('a1'),
      { id: 'p2', role: 'compact', kind: 'pr', url: 'https://b' },
      textMsg('fim'),
    ];
    expect(dropInvisible(msgs, false).map((m) => m.id)).toEqual(['p1', 'p2', 'fim']);
  });
});
