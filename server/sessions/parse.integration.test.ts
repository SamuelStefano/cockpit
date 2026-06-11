import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cfg = vi.hoisted(() => ({ CONFIG: { projectsDir: '', historyLimit: 500 } }));
vi.mock('../config', () => cfg);

import { parseSession, parseFullSession } from './parse';

const SID = '11111111-2222-4333-8444-555555555555';
const T0 = Date.parse('2026-06-10T12:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

// Fixture: caminho ativo u1 → a1(tool_use) → r1(tool_result) → a2 → m1(isMeta) → a3.
// 6 records na chain, 4 mensagens visíveis (r1 e m1 viram null no recToMessage).
const fixture = [
  { type: 'user', uuid: 'u1', parentUuid: null, timestamp: iso(T0), message: { role: 'user', content: 'roda o build' } },
  {
    type: 'assistant', uuid: 'a1', parentUuid: 'u1', timestamp: iso(T0 + 1000),
    message: {
      role: 'assistant', model: 'claude-fable-5',
      content: [{ type: 'tool_use', id: 'tu-1', name: 'Bash', input: { command: 'npm run build' } }],
    },
  },
  {
    type: 'user', uuid: 'r1', parentUuid: 'a1', timestamp: iso(T0 + 2500),
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu-1', content: 'build ok\n0 errors' }] },
  },
  {
    type: 'assistant', uuid: 'a2', parentUuid: 'r1', timestamp: iso(T0 + 3000),
    message: {
      role: 'assistant', usage: { input_tokens: 10, cache_read_input_tokens: 5 },
      content: [{ type: 'text', text: 'build passou' }],
    },
  },
  { type: 'user', uuid: 'm1', parentUuid: 'a2', isMeta: true, timestamp: iso(T0 + 4000), message: { role: 'user', content: 'loop wakeup sintético' } },
  {
    type: 'assistant', uuid: 'a3', parentUuid: 'm1', timestamp: iso(T0 + 5000),
    message: { role: 'assistant', content: [{ type: 'text', text: 'seguindo o loop' }] },
  },
  { type: 'last-prompt', leafUuid: 'a3' },
];

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'deck-parse-'));
  cfg.CONFIG.projectsDir = dir;
  await writeFile(join(dir, `${SID}.jsonl`), fixture.map((r) => JSON.stringify(r)).join('\n') + '\n');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('parseSession (arquivo real)', () => {
  it('reconstrói o caminho ativo só com mensagens visíveis', async () => {
    const out = await parseSession(SID);
    expect(out).not.toBeNull();
    expect(out!.messages.map((m) => m.id)).toEqual(['u1', 'a1', 'a2', 'a3']);
    expect(out!.truncated).toBe(false);
  });

  it('esconde user isMeta e tool_result records', async () => {
    const out = await parseSession(SID);
    const users = out!.messages.filter((m) => m.role === 'user');
    expect(users).toHaveLength(1);
    expect((users[0] as { text: string }).text).toBe('roda o build');
  });

  it('pareia tool_use com tool_result: status, saída e durationMs', async () => {
    const out = await parseSession(SID);
    const a1 = out!.messages.find((m) => m.id === 'a1');
    expect(a1?.role).toBe('assistant');
    const tool = (a1 as { blocks: Array<{ type: string; tool?: { status: string; output: string[]; durationMs?: number; command: string } }> })
      .blocks.find((b) => b.type === 'tool')?.tool;
    expect(tool?.status).toBe('done');
    expect(tool?.command).toBe('npm run build');
    expect(tool?.output).toEqual(['build ok', '0 errors']);
    expect(tool?.durationMs).toBe(1500);
  });

  it('tokens vêm do último assistant com usage no caminho', async () => {
    const out = await parseSession(SID);
    expect(out!.tokens).toBe(15);
  });

  it('truncated conta mensagens visíveis, não records brutos da chain', async () => {
    // chain tem 6 records mas só 4 mensagens; limit=4 NÃO pode truncar.
    const out = await parseSession(SID, 4);
    expect(out!.truncated).toBe(false);
    expect(out!.messages).toHaveLength(4);
  });

  it('trunca mantendo as mensagens mais recentes quando passa do limit', async () => {
    const out = await parseSession(SID, 3);
    expect(out!.truncated).toBe(true);
    expect(out!.messages.map((m) => m.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('rejeita sessionId fora do formato uuid', async () => {
    expect(await parseSession('../../etc/passwd')).toBeNull();
  });
});

describe('parseFullSession (arquivo real)', () => {
  it('devolve todas as mensagens visíveis em ordem de arquivo', async () => {
    const out = await parseFullSession(SID);
    expect(out).not.toBeNull();
    expect(out!.messages.map((m) => m.id)).toEqual(['u1', 'a1', 'a2', 'a3']);
    expect(out!.tokens).toBe(15);
  });

  it('limit corta mensagens visíveis, não records brutos', async () => {
    const out = await parseFullSession(SID, 2);
    expect(out!.messages.map((m) => m.id)).toEqual(['a2', 'a3']);
  });
});
