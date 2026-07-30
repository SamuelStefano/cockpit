import { describe, it, expect } from 'vitest';
import { collapseTurnTools } from './turn-tools';
import type { Block, Message, ToolCall } from '../../data/mock';

const tool = (id: string, extra: Partial<ToolCall> = {}): ToolCall => ({
  id, name: 'Bash', label: 'Bash', command: 'ls', status: 'done', output: [], ...extra,
});
const user = (id: string): Message => ({ id, role: 'user', text: 'oi' });
const assistant = (id: string, blocks: Block[]): Message => ({ id, role: 'assistant', blocks });

describe('collapseTurnTools', () => {
  it('junta as ferramentas de todas as mensagens do turno numa caixa só', () => {
    const out = collapseTurnTools([
      user('u1'),
      assistant('a1', [{ type: 'tool', tool: tool('t1') }]),
      assistant('a2', [{ type: 'tool', tool: tool('t2') }]),
      assistant('a3', [{ type: 'text', md: 'pronto' }]),
    ], true);
    expect(out.map((m) => m.id)).toEqual(['u1', 'digest:a1', 'a3']);
    expect(out[1].digest?.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('ancora a caixa onde a primeira ferramenta rodou', () => {
    const out = collapseTurnTools([
      user('u1'),
      assistant('a1', [{ type: 'text', md: 'vou olhar' }]),
      assistant('a2', [{ type: 'tool', tool: tool('t1') }]),
      assistant('a3', [{ type: 'text', md: 'achei' }]),
    ], true);
    expect(out.map((m) => m.id)).toEqual(['u1', 'a1', 'digest:a2', 'a3']);
  });

  it('uma caixa por turno — prompt novo fecha a anterior', () => {
    const out = collapseTurnTools([
      user('u1'),
      assistant('a1', [{ type: 'tool', tool: tool('t1') }]),
      user('u2'),
      assistant('a2', [{ type: 'tool', tool: tool('t2') }]),
    ], true);
    expect(out.map((m) => m.id)).toEqual(['u1', 'digest:a1', 'u2', 'digest:a2', 'a2']);
  });

  it('divisor no meio do turno não quebra a caixa', () => {
    const out = collapseTurnTools([
      user('u1'),
      assistant('a1', [{ type: 'tool', tool: tool('t1') }]),
      { id: 'c1', role: 'compact', kind: 'pr' },
      assistant('a2', [{ type: 'tool', tool: tool('t2') }]),
    ], true);
    expect(out.filter((m) => m.digest)).toHaveLength(1);
    expect(out.find((m) => m.digest)?.digest).toHaveLength(2);
  });

  it('AskUserQuestion e lista de tarefas continuam no fluxo', () => {
    const q = tool('q1', { name: 'AskUserQuestion', questions: [{ header: 'h', question: 'q?', options: [{ label: 'a', description: 'd' }], multiSelect: false }] });
    const todo = tool('td1', { name: 'TodoWrite', todos: [{ content: 'x', status: 'pending' }] });
    const out = collapseTurnTools([
      user('u1'),
      assistant('a1', [{ type: 'tool', tool: q }, { type: 'tool', tool: todo }, { type: 'tool', tool: tool('t1') }]),
    ], true);
    const kept = out.find((m) => m.id === 'a1');
    expect(kept?.role === 'assistant' && kept.blocks).toHaveLength(2);
    expect(out.find((m) => m.digest)?.digest).toHaveLength(1);
  });

  it('caixa antes do texto quando tudo veio na mesma bolha (caminho ao vivo)', () => {
    const out = collapseTurnTools([
      user('u1'),
      assistant('a1', [{ type: 'text', md: 'vou olhar' }, { type: 'tool', tool: tool('t1') }, { type: 'text', md: 'achei' }]),
    ], true);
    expect(out.map((m) => m.id)).toEqual(['u1', 'digest:a1', 'a1']);
    const kept = out[2];
    expect(kept.role === 'assistant' && kept.blocks.map((b) => b.type)).toEqual(['text', 'text']);
  });

  it('mesma entrada devolve as mesmas referências (memo do MessageRow)', () => {
    const msgs: Message[] = [
      user('u1'),
      assistant('a1', [{ type: 'text', md: 'oi' }, { type: 'tool', tool: tool('t1') }]),
    ];
    const a = collapseTurnTools(msgs, true);
    const b = collapseTurnTools(msgs, true);
    expect(b[1]).toBe(a[1]);
    expect(b[2]).toBe(a[2]);
  });

  it('com ferramentas ocultas devolve a thread intacta', () => {
    const msgs: Message[] = [user('u1'), assistant('a1', [{ type: 'tool', tool: tool('t1') }])];
    expect(collapseTurnTools(msgs, false)).toBe(msgs);
  });

  it('mantém a última mensagem mesmo esvaziada (âncora do indicador de turno)', () => {
    const out = collapseTurnTools([
      user('u1'),
      assistant('a1', [{ type: 'tool', tool: tool('t1', { status: 'running' }) }]),
    ], true);
    expect(out.map((m) => m.id)).toEqual(['u1', 'digest:a1', 'a1']);
  });
});
