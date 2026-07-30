import { describe, it, expect } from 'vitest';
import { pickOrphans, ORPHAN_MAX_AGE_MS, ORPHAN_MAX_RESUMES, type LiveRun } from './recover';

const now = 1_000_000_000;
const mk = (sessionKey: string, ageMs: number): LiveRun => ({ sessionKey, sessionId: `sid-${sessionKey}`, params: {}, startedAt: now - ageMs });
const map = (...rs: LiveRun[]) => Object.fromEntries(rs.map((r) => [r.sessionKey, r]));

describe('pickOrphans', () => {
  it('retoma o turno recente', () => {
    expect(pickOrphans(map(mk('a', 60_000)), now).map((r) => r.sessionKey)).toEqual(['a']);
  });

  it('descarta turno velho demais (VPS que ficou fora)', () => {
    expect(pickOrphans(map(mk('a', ORPHAN_MAX_AGE_MS + 1)), now)).toEqual([]);
  });

  it('corta no teto, preferindo os mais recentes', () => {
    const rs = Array.from({ length: ORPHAN_MAX_RESUMES + 3 }, (_, i) => mk(`s${i}`, i * 1000));
    const picked = pickOrphans(map(...rs), now);
    expect(picked).toHaveLength(ORPHAN_MAX_RESUMES);
    expect(picked[0].sessionKey).toBe('s0');
  });

  it('ignora entradas corrompidas sem derrubar as válidas', () => {
    const dirty = { ...map(mk('ok', 1000)), bad: { sessionKey: 'bad' } as unknown as LiveRun, nulo: null as unknown as LiveRun };
    expect(pickOrphans(dirty, now).map((r) => r.sessionKey)).toEqual(['ok']);
  });
});

describe('pickOrphans · item da fila', () => {
  const withParked = (parked: unknown): LiveRun =>
    ({ ...mk('a', 1000), parked } as unknown as LiveRun);

  it('preserva o item de fila que o turno morto carregava', () => {
    const item = { id: 'pk-1', prompt: 'arruma os exercícios', at: now, role: 'admin' };
    expect(pickOrphans(map(withParked(item)), now)[0].parked).toMatchObject({ id: 'pk-1', prompt: 'arruma os exercícios', role: 'admin' });
  });

  it('descarta item corrompido em vez de reexecutar lixo do disco', () => {
    expect(pickOrphans(map(withParked({ prompt: 'sem id' })), now)[0].parked).toBeUndefined();
    expect(pickOrphans(map(withParked('nao-e-objeto')), now)[0].parked).toBeUndefined();
  });
});
