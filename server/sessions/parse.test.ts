import { describe, it, expect } from 'vitest';
import { ctxTokens, num, diffOf, planOf, questionsOf, contentHasQuestion, todosOf, extractCommand, labelOf, commandOf, recToMessage, activeChain, collectToolResults, capOutput, turnStats, attachTurnStats, registerTaskCreate, applyTaskUpdate, taskSnapshot, taskTodos, attachTaskTodos, cleanUserText, markerFromRec, weaveByTs, finalTodos, truncateAtPendingQuestion, TOOL_OUTPUT_CAP, type Rec, type ToolResultRec, type TaskRegistry } from './parse';
import type { Message } from '../../shared/protocol';

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

describe('labelOf', () => {
  it('enriches subagent label with subagent_type', () => {
    expect(labelOf('Agent', { description: 'd', subagent_type: 'Explore' })).toBe('Agent · Explore');
    expect(labelOf('Task', { subagent_type: 'general-purpose' })).toBe('Task · general-purpose');
  });
  it('keeps the plain name for other tools or missing type', () => {
    expect(labelOf('Agent', { description: 'd' })).toBe('Agent');
    expect(labelOf('Bash', { command: 'ls' })).toBe('Bash');
    expect(labelOf('Read', null)).toBe('Read');
  });
  it('falls back to "tool" without a name', () => {
    expect(labelOf(undefined, {})).toBe('tool');
    expect(labelOf('', {})).toBe('tool');
  });
});

describe('commandOf', () => {
  it('TaskCreate shows the subject', () => {
    expect(commandOf('TaskCreate', { subject: 'Corrigir fila', description: 'longa' })).toBe('Corrigir fila');
  });
  it('TaskUpdate shows id, status and subject when present', () => {
    expect(commandOf('TaskUpdate', { taskId: '227', status: 'completed' })).toBe('#227 → completed');
    expect(commandOf('TaskUpdate', { taskId: 3, status: 'in_progress', subject: 'Novo título' })).toBe('#3 → in_progress · Novo título');
    expect(commandOf('TaskUpdate', { taskId: '8' })).toBe('#8');
  });
  it('falls back to extractCommand for other tools', () => {
    expect(commandOf('Bash', { command: 'ls' })).toBe('ls');
    expect(commandOf('Agent', { description: 'Revisar PR', subagent_type: 'Explore' })).toBe('Revisar PR');
    expect(commandOf('TaskUpdate', null)).toBe('');
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
    // blocos image agora viram placeholder '[imagem]' (paridade c/ terminal) em vez de sumir
    expect(map.get('t2')).toMatchObject({ output: ['err', '[imagem]'], isErr: true });
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

describe('turnStats (S3: stats históricas por turno do JSONL)', () => {
  const user = (uuid: string, text: string, ts?: string): Rec =>
    ({ type: 'user', uuid, message: { role: 'user', content: text }, timestamp: ts });
  const toolResultUser = (uuid: string): Rec =>
    ({ type: 'user', uuid, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }] } });
  const asst = (uuid: string, msgId: string | undefined, usage: Record<string, number> | undefined, ts?: string): Rec =>
    ({ type: 'assistant', uuid, message: { role: 'assistant', content: [{ type: 'text', text: 'oi' }], usage, id: msgId }, timestamp: ts });

  it('soma as chamadas API do turno SEM cache read e anexa no último assistant', () => {
    const recs = [
      user('u1', 'faz X', '2026-06-11T10:00:00.000Z'),
      asst('a1', 'm1', { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 1000 }),
      toolResultUser('tr1'),
      asst('a2', 'm2', { input_tokens: 5, output_tokens: 30, cache_read_input_tokens: 2000 }, '2026-06-11T10:00:42.000Z'),
    ];
    const map = turnStats(recs);
    expect(map.size).toBe(1);
    expect(map.get('a2')).toEqual({ tokens: 65, inputTokens: 15, outputTokens: 50, durationMs: 42000 });
  });

  it('deduplica records do mesmo message.id (um por content block, usage repetido)', () => {
    const recs = [
      user('u1', 'faz X'),
      asst('a1', 'm1', { input_tokens: 10, output_tokens: 20 }),
      asst('a2', 'm1', { input_tokens: 10, output_tokens: 20 }),
    ];
    expect(turnStats(recs).get('a2')).toMatchObject({ tokens: 30, inputTokens: 10, outputTokens: 20 });
  });

  it('separa turnos por user com texto; tool_result-only não é fronteira', () => {
    const recs = [
      user('u1', 'primeiro'),
      asst('a1', 'm1', { input_tokens: 1, output_tokens: 2 }),
      user('u2', 'segundo'),
      asst('a2', 'm2', { input_tokens: 3, output_tokens: 4 }),
      toolResultUser('tr1'),
      asst('a3', 'm3', { input_tokens: 5, output_tokens: 6 }),
    ];
    const map = turnStats(recs);
    expect(map.get('a1')).toMatchObject({ tokens: 3 });
    expect(map.get('a3')).toMatchObject({ tokens: 18, inputTokens: 8, outputTokens: 10 });
    expect(map.has('a2')).toBe(false);
  });

  it('sem usage nenhum no turno: não emite stat (tokens 0 = ruído)', () => {
    const recs = [user('u1', 'oi'), asst('a1', 'm1', undefined)];
    expect(turnStats(recs).size).toBe(0);
  });

  it('timestamps ausentes/invertidos: stat sai sem durationMs', () => {
    const recs = [
      user('u1', 'oi', '2026-06-11T10:00:10.000Z'),
      asst('a1', 'm1', { input_tokens: 1, output_tokens: 1 }, '2026-06-11T10:00:05.000Z'),
    ];
    expect(turnStats(recs).get('a1')).toEqual({ tokens: 2, inputTokens: 1, outputTokens: 1, durationMs: undefined });
  });

  it('records sem message.id são ignorados (espelha o dedupe do caminho ao vivo)', () => {
    const recs = [
      user('u1', 'oi'),
      asst('a1', undefined, { input_tokens: 1, output_tokens: 1 }),
      asst('a2', undefined, { input_tokens: 1, output_tokens: 1 }),
    ];
    expect(turnStats(recs).size).toBe(0);
  });
});

describe('attachTurnStats', () => {
  it('anota só os assistants presentes no map e ignora os demais', () => {
    const messages: Message[] = [
      { id: 'u1', role: 'user', text: 'oi' },
      { id: 'a1', role: 'assistant', blocks: [{ type: 'text', md: 'olá' }] },
      { id: 'a2', role: 'assistant', blocks: [{ type: 'text', md: 'fim' }] },
    ];
    attachTurnStats(messages, new Map([['a2', { tokens: 100, inputTokens: 1, outputTokens: 2 }]]));
    expect((messages[1] as any).stats).toBeUndefined();
    expect((messages[2] as any).stats).toEqual({ tokens: 100, inputTokens: 1, outputTokens: 2 });
  });
});

describe('registerTaskCreate / applyTaskUpdate / taskSnapshot (S6: lista de tarefas)', () => {
  it('TaskCreate registra a task com o número vindo do tool_result', () => {
    const tasks: TaskRegistry = new Map();
    const ok = registerTaskCreate(tasks, { subject: 'Corrigir bug', activeForm: 'Corrigindo bug' }, { output: ['Task #228 created successfully: Corrigir bug'], isErr: false });
    expect(ok).toBe(true);
    expect(tasks.get('228')).toEqual({ content: 'Corrigir bug', status: 'pending', activeForm: 'Corrigindo bug' });
  });

  it('TaskCreate sem result, com erro ou sem número não registra', () => {
    const tasks: TaskRegistry = new Map();
    expect(registerTaskCreate(tasks, { subject: 'x' }, undefined)).toBe(false);
    expect(registerTaskCreate(tasks, { subject: 'x' }, { output: ['Task #1 created'], isErr: true })).toBe(false);
    expect(registerTaskCreate(tasks, { subject: 'x' }, { output: ['sem numero'], isErr: false })).toBe(false);
    expect(registerTaskCreate(tasks, { nada: true }, { output: ['Task #1 created'], isErr: false })).toBe(false);
    expect(tasks.size).toBe(0);
  });

  it('TaskUpdate muda status, preserva campos anteriores e remove com deleted', () => {
    const tasks: TaskRegistry = new Map([['1', { content: 'A', status: 'pending' as const, activeForm: 'Fazendo A' }]]);
    expect(applyTaskUpdate(tasks, { taskId: '1', status: 'in_progress' })).toBe(true);
    expect(tasks.get('1')).toEqual({ content: 'A', status: 'in_progress', activeForm: 'Fazendo A' });
    expect(applyTaskUpdate(tasks, { taskId: 1, status: 'completed' })).toBe(true);
    expect(tasks.get('1')?.status).toBe('completed');
    expect(applyTaskUpdate(tasks, { taskId: '1', status: 'deleted' })).toBe(true);
    expect(tasks.size).toBe(0);
  });

  it('TaskUpdate de task desconhecida cria placeholder (lista global do harness)', () => {
    const tasks: TaskRegistry = new Map();
    expect(applyTaskUpdate(tasks, { taskId: '42', status: 'in_progress' })).toBe(true);
    expect(tasks.get('42')).toEqual({ content: 'Tarefa #42', status: 'in_progress', activeForm: undefined });
  });

  it('TaskUpdate sem taskId ou status inválido não quebra', () => {
    const tasks: TaskRegistry = new Map();
    expect(applyTaskUpdate(tasks, { status: 'in_progress' })).toBe(false);
    expect(applyTaskUpdate(tasks, null)).toBe(false);
    expect(applyTaskUpdate(tasks, { taskId: '9', status: 'banana' })).toBe(true);
    expect(tasks.get('9')?.status).toBe('pending');
  });

  it('taskSnapshot copia os itens (mutação posterior não vaza pro snapshot)', () => {
    const tasks: TaskRegistry = new Map([['1', { content: 'A', status: 'pending' as const }]]);
    const snap = taskSnapshot(tasks)!;
    tasks.get('1')!.status = 'completed';
    expect(snap[0].status).toBe('pending');
    expect(taskSnapshot(new Map())).toBeUndefined();
  });
});

describe('taskTodos + attachTaskTodos (S6: snapshots por tool_use)', () => {
  const asstTool = (uuid: string, id: string, name: string, input: unknown): Rec =>
    ({ type: 'assistant', uuid, message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } });

  it('carimba snapshot acumulado em cada mutação (create → update)', () => {
    const recs = [
      asstTool('a1', 'tc1', 'TaskCreate', { subject: 'A', activeForm: 'Fazendo A' }),
      asstTool('a2', 'tu1', 'TaskUpdate', { taskId: '1', status: 'in_progress' }),
    ];
    const results = new Map<string, ToolResultRec>([['tc1', { output: ['Task #1 created successfully'], isErr: false }]]);
    const map = taskTodos(recs, results);
    expect(map.get('tc1')).toEqual([{ content: 'A', status: 'pending', activeForm: 'Fazendo A' }]);
    expect(map.get('tu1')).toEqual([{ content: 'A', status: 'in_progress', activeForm: 'Fazendo A' }]);
  });

  it('ignora tools sem mutação e TaskCreate sem result', () => {
    const recs = [
      asstTool('a1', 'b1', 'Bash', { command: 'ls' }),
      asstTool('a2', 'tc1', 'TaskCreate', { subject: 'A' }),
    ];
    expect(taskTodos(recs, new Map()).size).toBe(0);
  });

  it('attachTaskTodos anota o tool block certo e não sobrescreve todos existentes', () => {
    const messages: Message[] = [
      { id: 'a1', role: 'assistant', blocks: [
        { type: 'tool', tool: { id: 'tc1', name: 'TaskCreate', label: 'x', command: '', status: 'done', output: [] } },
        { type: 'tool', tool: { id: 'tw1', name: 'TodoWrite', label: 'x', command: '', status: 'done', output: [], todos: [{ content: 'Velho', status: 'pending' }] } },
      ] },
    ];
    attachTaskTodos(messages, new Map([
      ['tc1', [{ content: 'Novo', status: 'pending' }]],
      ['tw1', [{ content: 'NÃO', status: 'pending' }]],
    ]));
    const blocks = (messages[0] as any).blocks;
    expect(blocks[0].tool.todos).toEqual([{ content: 'Novo', status: 'pending' }]);
    expect(blocks[1].tool.todos).toEqual([{ content: 'Velho', status: 'pending' }]);
  });
});

describe('cleanUserText (N2: slash e !comando como no terminal)', () => {
  it('slash command vira "/cmd args" limpo', () => {
    expect(cleanUserText('<command-name>/model</command-name>\n<command-message>model</command-message>\n<command-args>claude-fable-5</command-args>')).toBe('/model claude-fable-5');
    expect(cleanUserText('<command-name>/clear</command-name>\n<command-args></command-args>')).toBe('/clear');
  });

  it('local-command-stdout vira a saída sem ANSI; vazio vira null', () => {
    expect(cleanUserText('<local-command-stdout>[1mSet model to claude-fable-5[22m</local-command-stdout>')).toBe('Set model to claude-fable-5');
    expect(cleanUserText('<local-command-stdout></local-command-stdout>')).toBeNull();
  });

  it('texto normal passa intacto', () => {
    expect(cleanUserText('oi, tudo bem?')).toBe('oi, tudo bem?');
  });

  it('task-notification injetada pelo harness não vira bolha do usuário', () => {
    expect(cleanUserText('<task-notification>\n<task-id>a194764d9e2569a7f</task-id>\n<status>completed</status>\n</task-notification>')).toBeNull();
    expect(cleanUserText('  <task-notification><summary>x</summary></task-notification>')).toBeNull();
    // não confundir com texto que apenas menciona a palavra
    expect(cleanUserText('rodei uma task-notification manual')).toBe('rodei uma task-notification manual');
  });
});

describe('markerFromRec + weaveByTs (N2: pr-link e wakeup na timeline)', () => {
  it('pr-link vira divisor com label e url, dedup por URL', () => {
    const seen = new Set<string>();
    const rec = { type: 'pr-link', prNumber: 7, prUrl: 'https://github.com/x/y/pull/7', prRepository: 'x/y', timestamp: '2026-06-12T00:00:00.000Z' } as unknown as Rec;
    const m = markerFromRec(rec, seen);
    expect(m).toMatchObject({ role: 'compact', kind: 'pr', label: 'PR #7 · x/y', url: 'https://github.com/x/y/pull/7' });
    expect(markerFromRec(rec, seen)).toBeNull();
  });

  it('scheduled_task_fire vira divisor wakeup com o texto do harness', () => {
    const m = markerFromRec({ type: 'system', subtype: 'scheduled_task_fire', content: 'Claude resuming /loop wakeup', uuid: 'w1', timestamp: '2026-06-12T00:00:00.000Z' } as unknown as Rec, new Set());
    expect(m).toMatchObject({ id: 'w1', role: 'compact', kind: 'wakeup', label: 'Claude resuming /loop wakeup' });
  });

  it('records comuns não viram marcador', () => {
    expect(markerFromRec({ type: 'assistant' } as Rec, new Set())).toBeNull();
    expect(markerFromRec({ type: 'system', subtype: 'turn_duration' } as unknown as Rec, new Set())).toBeNull();
  });

  it('weaveByTs insere por timestamp preservando a ordem das mensagens', () => {
    const msgs = [
      { id: 'a', role: 'user', text: '1', ts: 100 },
      { id: 'b', role: 'assistant', blocks: [], ts: 300 },
    ] as Message[];
    const extras = [
      { id: 'm2', role: 'compact', kind: 'pr', ts: 200 },
      { id: 'm1', role: 'compact', kind: 'wakeup', ts: 50 },
    ] as Message[];
    expect(weaveByTs(msgs, extras).map((m) => m.id)).toEqual(['m1', 'a', 'm2', 'b']);
    expect(weaveByTs(msgs, [])).toBe(msgs);
  });
});

describe('finalTodos (tray pós-compact)', () => {
  it('devolve o último snapshot do map (ordem do arquivo)', () => {
    const map = new Map([
      ['t1', [{ content: 'A', status: 'pending' as const }]],
      ['t2', [{ content: 'A', status: 'completed' as const }]],
    ]);
    expect(finalTodos(map)).toEqual([{ content: 'A', status: 'completed' }]);
    expect(finalTodos(new Map())).toBeUndefined();
  });
});

describe('truncateAtPendingQuestion (AskUserQuestion sem resposta)', () => {
  const q = (id: string): Message => ({ id, role: 'assistant', blocks: [{ type: 'tool', tool: { id: id + 't', name: 'AskUserQuestion', label: 'x', command: '', status: 'done', output: [], questions: [{ question: 'Q?', header: 'H', multiSelect: false, options: [{ label: 'A' }] }] } }] });
  const asst = (id: string): Message => ({ id, role: 'assistant', blocks: [{ type: 'text', md: 'continuacao' }] });
  const user = (id: string): Message => ({ id, role: 'user', text: 'oi' });

  it('corta a continuacao quando a pergunta nao tem prompt depois', () => {
    const out = truncateAtPendingQuestion([user('u1'), q('a1'), asst('a2'), asst('a3')]);
    expect(out.map((m) => m.id)).toEqual(['u1', 'a1']);
  });
  it('NAO corta quando o usuario ja respondeu (prompt apos a pergunta)', () => {
    const msgs = [user('u1'), q('a1'), user('u2'), asst('a2')];
    expect(truncateAtPendingQuestion(msgs)).toBe(msgs);
  });
  it('sem pergunta: devolve intacto', () => {
    const msgs = [user('u1'), asst('a1')];
    expect(truncateAtPendingQuestion(msgs)).toBe(msgs);
  });
});
