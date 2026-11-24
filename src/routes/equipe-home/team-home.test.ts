import { describe, it, expect } from 'vitest';
import type { TeamState } from '../../../shared/team-state';
import { ago, nameOf, nudgeText, primaryBot, sectionsOf } from './team-home';

const state: TeamState = {
  at: 0, followUpHours: 4, handoffs: [], followUps: [],
  bots: [
    { id: 'a', name: 'Anderson', role: 'TL', status: 'waiting' },
    { id: 'z', name: 'Zoro', role: 'CTO', status: 'working', task: 'Deck' },
    { id: 'r', name: 'Raquel', role: 'Revisão', status: 'idle' },
  ],
};

describe('team-home', () => {
  it('formats elapsed time in minutes, hours and days', () => {
    expect(ago(12 * 60_000)).toBe('há 12 min');
    expect(ago(5 * 3_600_000)).toBe('há 5 h');
    expect(ago(72 * 3_600_000)).toBe('há 3 d');
  });
  it('splits the snapshot by status', () => {
    const s = sectionsOf(state);
    expect(s.waiting.map((b) => b.name)).toEqual(['Anderson']);
    expect(s.working.map((b) => b.name)).toEqual(['Zoro']);
    expect(s.idle).toBe(1);
  });
  it('resolves names and the primary bot', () => {
    expect(nameOf(state, 'z')).toBe('Zoro');
    expect(nameOf(state, 'x')).toBe('x');
    expect(primaryBot([{ id: 'l', primary: true } as never, { id: 'n' } as never])?.id).toBe('l');
  });
  it('builds the nudge text', () => {
    expect(nudgeText('Anderson', 'Raquel', 'há 5 h')).toContain('Anderson aguarda');
  });
});
