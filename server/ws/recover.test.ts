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
