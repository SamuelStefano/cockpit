import { describe, it, expect } from 'vitest';
import { recToMessage, turnStats, attachTurnStats, cleanUserText, weaveByTs, markersInRange, truncateAtPendingQuestion } from './parse';
import type { Rec, ToolResultRec } from './records';
import type { Message } from '../../shared/protocol';

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

  it('descarta o assistant "No response requested." injetado pelo resume pós-pergunta', () => {
    expect(recToMessage({ uuid: 'g1', message: { role: 'assistant', content: [{ type: 'text', text: 'No response requested.' }] } } as any)).toBeNull();
  });

  it('mantém assistant que só MENCIONA "No response requested." junto de outro conteúdo', () => {
    const m = recToMessage({ uuid: 'g2', message: { role: 'assistant', content: [
      { type: 'text', text: 'No response requested.' }, { type: 'text', text: 'mas segue o jogo' },
    ] } } as any);
    expect(m).not.toBeNull();
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

describe('cleanUserText (N2: slash e !comando como no terminal)', () => {
  it('task-notification injetada pelo harness não vira bolha do usuário', () => {
    expect(cleanUserText('<task-notification>\n<task-id>a194764d9e2569a7f</task-id>\n<status>completed</status>\n</task-notification>')).toBeNull();
    expect(cleanUserText('  <task-notification><summary>x</summary></task-notification>')).toBeNull();
    expect(cleanUserText('rodei uma task-notification manual')).toBe('rodei uma task-notification manual');
    expect(cleanUserText('olha o que voltou: <task-notification>x</task-notification>')).toBe('olha o que voltou: <task-notification>x</task-notification>');
  });

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

describe('weaveByTs + markersInRange (marcadores na timeline)', () => {
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

  it('markersInRange descarta marcador anterior à 1ª visível e marcador sem ts', () => {
    const msgs = [{ id: 'a', role: 'user', text: '1', ts: 100 }] as Message[];
    const extras = [
      { id: 'velho', role: 'compact', kind: 'pr', ts: 50 },
      { id: 'novo', role: 'compact', kind: 'pr', ts: 150 },
      { id: 'sem-ts', role: 'compact', kind: 'pr' },
    ] as Message[];
    expect(markersInRange(msgs, extras).map((m) => m.id)).toEqual(['novo']);
  });

  it('markersInRange sem mensagem com ts mantém tudo', () => {
    const extras = [{ id: 'p', role: 'compact', kind: 'pr', ts: 50 }] as Message[];
    expect(markersInRange([], extras)).toBe(extras);
  });
});
