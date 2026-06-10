import { describe, it, expect } from 'vitest';
import { ctxTokens, num, diffOf, planOf, questionsOf, contentHasQuestion, todosOf, extractCommand, recToMessage, activeChain, type Rec } from './parse';

describe('num', () => {
  it('passes through finite non-negative numbers', () => {
    expect(num(0)).toBe(0);
    expect(num(42)).toBe(42);
  });
  it('coerces numeric strings (JSONL fields can arrive as strings)', () => {
    expect(num('123')).toBe(123);
  });
  it('rejects NaN/Infinity/negatives/garbage to 0', () => {
    expect(num(NaN)).toBe(0);
    expect(num(Infinity)).toBe(0);
    expect(num(-5)).toBe(0);
    expect(num('abc')).toBe(0);
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num({})).toBe(0);
  });
});

describe('ctxTokens', () => {
  it('returns 0 for undefined', () => {
    expect(ctxTokens(undefined)).toBe(0);
  });
  it('sums input + cache creation + cache read', () => {
    expect(ctxTokens({ input_tokens: 10, cache_creation_input_tokens: 5, cache_read_input_tokens: 100 })).toBe(115);
  });
  it('treats missing fields as 0', () => {
    expect(ctxTokens({ input_tokens: 7 })).toBe(7);
  });
  it('never lets a dirty JSONL usage field poison the total', () => {
    expect(ctxTokens({ input_tokens: NaN as number, cache_read_input_tokens: 10 })).toBe(10);
    expect(ctxTokens({ input_tokens: '50' as unknown as number })).toBe(50);
    expect(ctxTokens({ input_tokens: -1 as number, cache_creation_input_tokens: 3 })).toBe(3);
  });
});

describe('diffOf', () => {
  it('extracts Edit old/new', () => {
    expect(diffOf('Edit', { file_path: '/a.ts', old_string: 'x', new_string: 'y' }))
      .toEqual({ path: '/a.ts', old: 'x', new: 'y' });
  });
  it('treats Write content as new with empty old', () => {
    expect(diffOf('Write', { file_path: '/a.ts', content: 'hello' }))
      .toEqual({ path: '/a.ts', old: '', new: 'hello' });
  });
  it('joins MultiEdit hunks into one pair', () => {
    const d = diffOf('MultiEdit', { file_path: '/a.ts', edits: [
      { old_string: 'a', new_string: 'A' },
      { old_string: 'b', new_string: 'B' },
    ] });
    expect(d).toEqual({ path: '/a.ts', old: 'a\nb', new: 'A\nB' });
  });
  it('returns undefined without a file_path', () => {
    expect(diffOf('Edit', { old_string: 'x', new_string: 'y' })).toBeUndefined();
  });
  it('returns undefined for non-diff tools', () => {
    expect(diffOf('Bash', { command: 'ls' })).toBeUndefined();
  });
});

describe('planOf', () => {
  it('extracts ExitPlanMode plan', () => {
    expect(planOf('ExitPlanMode', { plan: '# Plano' })).toBe('# Plano');
  });
  it('ignores blank or wrong tools', () => {
    expect(planOf('ExitPlanMode', { plan: '   ' })).toBeUndefined();
    expect(planOf('Edit', { plan: 'x' })).toBeUndefined();
  });
});

describe('questionsOf', () => {
  const input = {
    questions: [
      {
        question: 'Qual abordagem?',
        header: 'Abordagem',
        multiSelect: false,
        options: [
          { label: 'A', description: 'desc A' },
          { label: 'B' },
        ],
      },
    ],
  };
  it('extracts AskUserQuestion questions', () => {
    const q = questionsOf('AskUserQuestion', input);
    expect(q).toHaveLength(1);
    expect(q![0].question).toBe('Qual abordagem?');
    expect(q![0].header).toBe('Abordagem');
    expect(q![0].multiSelect).toBe(false);
    expect(q![0].options).toEqual([
      { label: 'A', description: 'desc A' },
      { label: 'B', description: undefined },
    ]);
  });
  it('ignores wrong tool or bad shape', () => {
    expect(questionsOf('Edit', input)).toBeUndefined();
    expect(questionsOf('AskUserQuestion', {})).toBeUndefined();
    expect(questionsOf('AskUserQuestion', { questions: [] })).toBeUndefined();
  });
  it('drops questions without text or options', () => {
    expect(questionsOf('AskUserQuestion', { questions: [{ question: '', options: [{ label: 'X' }] }] })).toBeUndefined();
    expect(questionsOf('AskUserQuestion', { questions: [{ question: 'q', options: [] }] })).toBeUndefined();
  });
});

describe('contentHasQuestion', () => {
  const q = { type: 'tool_use', name: 'AskUserQuestion', input: { questions: [{ question: 'q', options: [{ label: 'A' }] }] } };
  it('detecta AskUserQuestion válida no conteúdo do assistant', () => {
    expect(contentHasQuestion([{ type: 'text', text: 'oi' }, q])).toBe(true);
  });
  it('ignora conteúdo sem pergunta', () => {
    expect(contentHasQuestion([{ type: 'text', text: 'oi' }])).toBe(false);
    expect(contentHasQuestion([{ type: 'tool_use', name: 'Edit', input: {} }])).toBe(false);
    expect(contentHasQuestion('texto')).toBe(false);
    expect(contentHasQuestion(undefined)).toBe(false);
  });
});

describe('todosOf', () => {
  const input = {
    todos: [
      { content: 'Ler arquivo', status: 'completed' },
      { content: 'Rodar testes', status: 'in_progress', activeForm: 'Rodando testes' },
      { content: 'Abrir PR', status: 'pending' },
    ],
  };
  it('extracts TodoWrite todos', () => {
    const t = todosOf('TodoWrite', input);
    expect(t).toHaveLength(3);
    expect(t![0]).toEqual({ content: 'Ler arquivo', status: 'completed', activeForm: undefined });
    expect(t![1]).toEqual({ content: 'Rodar testes', status: 'in_progress', activeForm: 'Rodando testes' });
    expect(t![2].status).toBe('pending');
  });
  it('coerces unknown status to pending', () => {
    const t = todosOf('TodoWrite', { todos: [{ content: 'X', status: 'weird' }] });
    expect(t![0].status).toBe('pending');
  });
  it('ignores wrong tool or bad shape', () => {
    expect(todosOf('Edit', input)).toBeUndefined();
    expect(todosOf('TodoWrite', {})).toBeUndefined();
    expect(todosOf('TodoWrite', { todos: [] })).toBeUndefined();
    expect(todosOf('TodoWrite', { todos: [{ content: '', status: 'pending' }] })).toBeUndefined();
  });
});

describe('extractCommand', () => {
  it('prefers command over other keys', () => {
    expect(extractCommand({ command: 'ls -la', file_path: '/a.ts' })).toBe('ls -la');
  });
  it('falls back through the key precedence list', () => {
    expect(extractCommand({ file_path: '/a.ts' })).toBe('/a.ts');
    expect(extractCommand({ pattern: 'foo' })).toBe('foo');
    expect(extractCommand({ url: 'https://x' })).toBe('https://x');
    expect(extractCommand({ query: 'q' })).toBe('q');
    expect(extractCommand({ description: 'd' })).toBe('d');
  });
  it('skips empty strings to reach the next key', () => {
    expect(extractCommand({ command: '', file_path: '/a.ts' })).toBe('/a.ts');
  });
  it('ignores non-string values', () => {
    expect(extractCommand({ command: 42, pattern: 'p' })).toBe('p');
  });
  it('returns empty for non-objects or no matching key', () => {
    expect(extractCommand(null)).toBe('');
    expect(extractCommand('str')).toBe('');
    expect(extractCommand({ other: 'x' })).toBe('');
  });
});

describe('recToMessage', () => {
  it('returns null when there is no message', () => {
    expect(recToMessage({ type: 'summary' } as any)).toBeNull();
  });

  it('builds a user message from string content', () => {
    const m = recToMessage({ uuid: 'u1', timestamp: '2026-06-06T00:00:00.000Z', message: { role: 'user', content: 'hello' } } as any);
    expect(m).toMatchObject({ id: 'u1', role: 'user', text: 'hello' });
    expect(m?.ts).toBe(Date.parse('2026-06-06T00:00:00.000Z'));
  });

  it('joins text parts in user array content', () => {
    const m = recToMessage({ uuid: 'u2', message: { role: 'user', content: [
      { type: 'text', text: 'a' }, { type: 'tool_result', content: 'x' }, { type: 'text', text: 'b' },
    ] } } as any);
    expect(m).toMatchObject({ role: 'user', text: 'a\nb' });
  });

  it('drops empty/whitespace-only user messages', () => {
    expect(recToMessage({ uuid: 'u3', message: { role: 'user', content: '   ' } } as any)).toBeNull();
  });

  it('builds assistant blocks for text, thinking and tool_use', () => {
    const m = recToMessage({ uuid: 'a1', message: { role: 'assistant', content: [
      { type: 'text', text: 'hi' },
      { type: 'thinking', thinking: 'hmm' },
      { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } },
    ] } } as any);
    expect(m?.role).toBe('assistant');
    expect((m as any).blocks).toEqual([
      { type: 'text', md: 'hi' },
      { type: 'thinking', text: 'hmm' },
      { type: 'tool', tool: expect.objectContaining({ id: 't1', name: 'Bash', command: 'ls', status: 'done' }) },
    ]);
  });

  it('returns null for assistant with no usable blocks', () => {
    expect(recToMessage({ uuid: 'a2', message: { role: 'assistant', content: [{ type: 'image' }] } } as any)).toBeNull();
  });

  it('leaves ts undefined for an unparseable timestamp', () => {
    const m = recToMessage({ uuid: 'u4', timestamp: 'not-a-date', message: { role: 'user', content: 'x' } } as any);
    expect(m?.ts).toBeUndefined();
  });

  it('maps an isCompactSummary user record to a compact divider', () => {
    const m = recToMessage({
      uuid: 'c1',
      timestamp: '2026-06-10T00:00:00.000Z',
      isCompactSummary: true,
      message: { role: 'user', content: 'This session is being continued from a previous conversation…' },
    } as any);
    expect(m).toMatchObject({ id: 'c1', role: 'compact', trigger: 'auto' });
    expect(m?.ts).toBe(Date.parse('2026-06-10T00:00:00.000Z'));
  });
});

describe('activeChain', () => {
  const mk = (uuid: string, parent: string | null, type = 'user'): Rec => ({ type, uuid, parentUuid: parent });
  const index = (recs: Rec[]) => new Map(recs.map((r) => [r.uuid!, r]));

  it('walks parentUuid root→leaf order from a valid leaf', () => {
    const recs = [mk('a', null), mk('b', 'a'), mk('c', 'b')];
    const chain = activeChain(index(recs), 'c', 'c');
    expect(chain.map((r) => r.uuid)).toEqual(['a', 'b', 'c']);
  });

  it('falls back to last message when the leaf is missing locally', () => {
    const recs = [mk('a', null), mk('b', 'a')];
    const chain = activeChain(index(recs), 'ghost-leaf', 'b');
    expect(chain.map((r) => r.uuid)).toEqual(['a', 'b']);
  });

  it('walks through intermediate non-message records but excludes them', () => {
    const recs = [mk('a', null), { type: 'system', uuid: 's', parentUuid: 'a' } as Rec, mk('b', 's')];
    const chain = activeChain(index(recs), 'b', 'b');
    expect(chain.map((r) => r.uuid)).toEqual(['a', 'b']);
  });

  it('guards against parentUuid cycles', () => {
    const recs = [mk('a', 'b'), mk('b', 'a')];
    const chain = activeChain(index(recs), 'a', 'a');
    expect(chain.length).toBe(2);
  });
});
