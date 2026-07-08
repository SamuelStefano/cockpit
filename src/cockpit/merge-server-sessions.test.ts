// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { mergeServerSessions } from './session';
import type { Session } from '../data/mock';
import type { SessionMeta } from '../../shared/protocol';

const meta = (over: Partial<SessionMeta> = {}): SessionMeta => ({
  id: 's1', title: 'T', relative: 'há 2h', snippet: 'velho', mtime: 1000, count: 1, ...over,
});
const sess = (over: Partial<Session> = {}): Session => ({
  id: 's1', title: 'T', relative: 'há 2h', snippet: 'velho', mtime: 1000, hasTerminal: false, active: false, ...over,
});

describe('mergeServerSessions', () => {
  it('preserva o mtime otimista quando o servidor vem atrás (JSONL ainda não gravado)', () => {
    // Local: acabei de mandar mensagem — mtime bumpado, relative/snippet novos.
    const prev = [sess({ mtime: 5000, relative: 'agora', snippet: 'nova msg' })];
    const items = [meta({ mtime: 1000, relative: 'há 2h', snippet: 'velho' })];
    const [s] = mergeServerSessions(prev, items, 's1');
    expect(s.mtime).toBe(5000);
    expect(s.relative).toBe('agora');
    expect(s.snippet).toBe('nova msg');
  });

  it('usa o mtime do servidor quando ele já alcançou/passou o otimista', () => {
    const prev = [sess({ mtime: 5000, relative: 'agora' })];
    const items = [meta({ mtime: 6000, relative: 'agora mesmo', snippet: 'do servidor' })];
    const [s] = mergeServerSessions(prev, items, 's1');
    expect(s.mtime).toBe(6000);
    expect(s.relative).toBe('agora mesmo');
    expect(s.snippet).toBe('do servidor');
  });

  it('mantém as sessões locais new- (ainda não persistidas) no topo', () => {
    const prev = [sess({ id: 'new-abc', mtime: 9000 }), sess({ id: 's1', mtime: 1000 })];
    const items = [meta({ id: 's1', mtime: 1000 })];
    const out = mergeServerSessions(prev, items, 's1');
    expect(out.map((s) => s.id)).toEqual(['new-abc', 's1']);
  });

  it('marca a sessão ativa', () => {
    const out = mergeServerSessions([], [meta({ id: 's1' }), meta({ id: 's2' })], 's2');
    expect(out.find((s) => s.id === 's2')?.active).toBe(true);
    expect(out.find((s) => s.id === 's1')?.active).toBe(false);
  });

  it('sem estado local anterior, reflete o servidor tal qual', () => {
    const out = mergeServerSessions([], [meta({ mtime: 1000 })], 's1');
    expect(out[0].mtime).toBe(1000);
  });
});
