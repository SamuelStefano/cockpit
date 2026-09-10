import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFunnelPrompt, funnelFile, funnelSessions, funnelSlug, shareCap, MAX_SESSIONS } from './funnel';
import { FUNNEL_INSTR } from '../shared/funnel-prompt';
import { CONFIG } from './config';
import { parseSession } from './sessions/parse';
import { metaForId } from './sessions/index';
import { distillPrompt } from './handoff';
import { hideSession } from './store';

vi.mock('./sessions/parse', () => ({ parseSession: vi.fn() }));
vi.mock('./sessions/index', () => ({ metaForId: vi.fn() }));
vi.mock('./store', () => ({ hideSession: vi.fn() }));
vi.mock('./handoff', async (orig) => ({ ...(await orig<typeof import('./handoff')>()), distillPrompt: vi.fn() }));

const at = new Date('2026-08-01T02:00:00Z'); // 31/07 23:00 em Maringá
const id = (n: number) => `0000000${n}-aaaa-bbbb-cccc-dddddddddddd`;
const msg = (text: string) => ({ id: 'm1', role: 'user' as const, text });

beforeEach(async () => {
  vi.clearAllMocks();
  CONFIG.memoryDir = await mkdtemp(join(tmpdir(), 'funnel-'));
  vi.mocked(parseSession).mockResolvedValue({ messages: [msg('trabalhei no relay')] } as never);
  vi.mocked(metaForId).mockResolvedValue({ title: 'relay' } as never);
  vi.mocked(distillPrompt).mockResolvedValue('## relay\n- deploy manual');
});

describe('shareCap', () => {
  it('divide o orçamento entre as sessões, com piso', () => {
    expect(shareCap(2)).toBe(30_000);
    expect(shareCap(100)).toBe(1_500); // piso: ninguém fica sem fatia
  });
});

describe('funnelSlug', () => {
  it('carimba o dia em BRT e só numera a partir do segundo do dia', () => {
    expect(funnelSlug(at, 1)).toBe('funil-20260731');
    expect(funnelSlug(at, 2)).toBe('funil-20260731-2');
  });
});

describe('buildFunnelPrompt', () => {
  it('leva a instrução compartilhada e um cabeçalho por sessão', () => {
    const p = buildFunnelPrompt([{ title: 'a', transcript: 'x' }, { title: 'b', transcript: 'y' }]);
    expect(p.startsWith(FUNNEL_INSTR)).toBe(true);
    expect(p).toContain('# SESSÃO: a');
    expect(p).toContain('# SESSÃO: b');
  });
});

describe('funnelFile', () => {
  it('grava frontmatter válido de contexto', () => {
    const f = funnelFile('funil-20260731', 3, '## a\n- b', at);
    expect(f).toContain('name: funil-20260731');
    expect(f).toContain('type: reference');
    expect(f).toContain('## a');
  });
});

describe('funnelSessions', () => {
  it('grava um dossiê só e arquiva todas as sessões', async () => {
    const r = await funnelSessions([id(1), id(2)], at);
    expect(r).toEqual({ contextId: 'funil-20260731', archived: 2, empty: 0 });
    expect(vi.mocked(hideSession).mock.calls.map((c) => c[0])).toEqual([id(1), id(2)]);
    const body = await readFile(join(CONFIG.memoryDir, 'funil-20260731.md'), 'utf8');
    expect(body).toContain('- deploy manual');
  });

  it('não arquiva nada quando a destilação falha', async () => {
    vi.mocked(distillPrompt).mockResolvedValue(null);
    const r = await funnelSessions([id(1)], at);
    expect('error' in r).toBe(true);
    expect(hideSession).not.toHaveBeenCalled();
  });

  it('não sobrescreve o dossiê de um afunilamento anterior do mesmo dia', async () => {
    await writeFile(join(CONFIG.memoryDir, 'funil-20260731.md'), 'primeiro', 'utf8');
    const r = await funnelSessions([id(1)], at);
    expect(r).toMatchObject({ contextId: 'funil-20260731-2' });
    expect(await readFile(join(CONFIG.memoryDir, 'funil-20260731.md'), 'utf8')).toBe('primeiro');
  });

  it('sessão sem conversa é arquivada sem entrar no prompt', async () => {
    vi.mocked(parseSession).mockImplementation(async (s: string) => (s === id(1) ? { messages: [msg('oi')] } : { messages: [] }) as never);
    const r = await funnelSessions([id(1), id(2)], at);
    expect(r).toMatchObject({ archived: 2, empty: 1 });
    expect(vi.mocked(distillPrompt).mock.calls[0][0]).not.toContain('SESSÃO: relay\n\n');
  });

  it('recusa ids fora do formato e capa o lote', async () => {
    expect(await funnelSessions(['../../etc/passwd'], at)).toEqual({ error: 'nenhuma sessão elegível' });
    const many = Array.from({ length: MAX_SESSIONS + 5 }, (_, i) => `${String(i).padStart(8, '0')}-aaaa-bbbb-cccc-dddddddddddd`);
    const r = await funnelSessions(many, at);
    expect(r).toMatchObject({ archived: MAX_SESSIONS });
  });
});
