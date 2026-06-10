import { describe, it, expect } from 'vitest';
import { ctxTokens, num, diffOf, planOf, questionsOf, contentHasQuestion, todosOf, extractCommand, recToMessage, activeChain, collectToolResults, capOutput, TOOL_OUTPUT_CAP, type Rec, type ToolResultRec } from './parse';

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

  it('hides synthetic isMeta user prompts (loop wakeups) instead of attributing them to the user', () => {
    const m = recToMessage({
      uuid: 'm1',
      isMeta: true,
      message: { role: 'user', content: '# Autonomous loop tick (dynamic pacing)\nRun the autonomous check…' },
    } as any);
    expect(m).toBeNull();
  });

  it('keeps isMeta assistant records untouched', () => {
    const m = recToMessage({ uuid: 'a9', isMeta: true, message: { role: 'assistant', content: [{ type: 'text', text: 'oi' }] } } as any);
    expect(m).toMatchObject({ role: 'assistant' });
  });

  it('pairs a tool_result with its tool_use: output, status, exit and duration', () => {
    const results = new Map<string, ToolResultRec>([
      ['t1', { output: ['{ "status": "error" }'], isErr: false, ts: Date.parse('2026-06-10T20:20:53.000Z') }],
    ]);
    const m = recToMessage({
      uuid: 'a1',
      timestamp: '2026-06-10T20:20:16.000Z',
      message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'curl …' } }] },
    } as any, results);
    const tool = (m as any).blocks[0].tool;
    expect(tool.output).toEqual(['{ "status": "error" }']);
    expect(tool.status).toBe('done');
    expect(tool.exit).toBe(0);
    expect(tool.durationMs).toBe(37_000);
  });

  it('marks the tool as error when the result has is_error', () => {
    const results = new Map<string, ToolResultRec>([['t2', { output: ['boom'], isErr: true }]]);
    const m = recToMessage({
      uuid: 'a2',
      message: { role: 'assistant', content: [{ type: 'tool_use', id: 't2', name: 'Bash', input: {} }] },
    } as any, results);
    const tool = (m as any).blocks[0].tool;
    expect(tool.status).toBe('error');
    expect(tool.exit).toBe(1);
  });

  it('leaves duration/exit undefined when no result exists (pruned run)', () => {
    const m = recToMessage({
      uuid: 'a3',
      message: { role: 'assistant', content: [{ type: 'tool_use', id: 't3', name: 'Bash', input: {} }] },
    } as any, new Map());
    const tool = (m as any).blocks[0].tool;
    expect(tool.output).toEqual([]);
    expect(tool.exit).toBeUndefined();
    expect(tool.durationMs).toBeUndefined();
    expect(tool.status).toBe('done');
  });

  it('ignores a result timestamp older than the tool_use (clock skew)', () => {
    const results = new Map<string, ToolResultRec>([['t4', { output: ['x'], isErr: false, ts: Date.parse('2026-06-10T00:00:00.000Z') }]]);
    const m = recToMessage({
      uuid: 'a4',
      timestamp: '2026-06-10T00:00:01.000Z',
      message: { role: 'assistant', content: [{ type: 'tool_use', id: 't4', name: 'Bash', input: {} }] },
    } as any, results);
    expect((m as any).blocks[0].tool.durationMs).toBeUndefined();
  });
});

describe('collectToolResults', () => {
  it('extracts string content split by lines, keyed by tool_use_id', () => {
    const map = new Map<string, ToolResultRec>();
    collectToolResults({
      type: 'user',
      timestamp: '2026-06-10T20:20:53.000Z',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'line1\nline2' }] },
    } as any, map);
    expect(map.get('t1')).toMatchObject({ output: ['line1', 'line2'], isErr: false });
    expect(map.get('t1')?.ts).toBe(Date.parse('2026-06-10T20:20:53.000Z'));
  });

  it('extracts text blocks from array content and flags is_error', () => {
    const map = new Map<string, ToolResultRec>();
    collectToolResults({
      type: 'user',
      message: { role: 'user', content: [
        { type: 'tool_result', tool_use_id: 't2', is_error: true, content: [{ type: 'text', text: 'err' }, { type: 'image' }] },
      ] },
    } as any, map);
    expect(map.get('t2')).toMatchObject({ output: ['err'], isErr: true });
  });

  it('ignores non-user records, plain text content and results without tool_use_id', () => {
    const map = new Map<string, ToolResultRec>();
    collectToolResults({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'y' }] } } as any, map);
    collectToolResults({ type: 'user', message: { role: 'user', content: 'oi' } } as any, map);
    collectToolResults({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'sem id' }] } } as any, map);
    expect(map.size).toBe(0);
  });

  it('caps giant outputs with the shared truncation marker', () => {
    const map = new Map<string, ToolResultRec>();
    collectToolResults({
      type: 'user',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't3', content: 'x'.repeat(TOOL_OUTPUT_CAP + 100) }] },
    } as any, map);
    const out = map.get('t3')!.output;
    expect(out[out.length - 1]).toContain('truncada');
    expect(out.join('\n').length).toBeLessThanOrEqual(TOOL_OUTPUT_CAP + 100);
  });
});

describe('capOutput', () => {
  it('passes small outputs through untouched', () => {
    expect(capOutput(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('truncates at the cap and appends the marker', () => {
    const out = capOutput(['x'.repeat(TOOL_OUTPUT_CAP), 'overflow']);
    expect(out[out.length - 1]).toContain('truncada');
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
