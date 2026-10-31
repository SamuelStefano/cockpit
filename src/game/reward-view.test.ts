import { describe, it, expect } from 'vitest';
import { rewardViews, turnXp } from './reward-view';

describe('rewardViews', () => {
  it('skips xp and maps achievements, quests, streak and level', () => {
    const v = rewardViews([
      { kind: 'xp', amount: 25, source: 'turn_done' },
      { kind: 'achievement', id: 'first-turn' },
      { kind: 'quest', id: 'turns-3' },
      { kind: 'quest', id: 'bonus', bonus: true },
      { kind: 'streak', days: 3 },
      { kind: 'level', level: 2, title: 'Estagiário de Prompt' },
    ]);
    expect(v.map((x) => x.kind)).toEqual(['achievement', 'quest', 'quest', 'streak', 'level']);
    expect(v[0].title).toBe('Primeiro turno');
    expect(v[4].level).toBe(2);
  });
  it('ignores unknown ids', () => {
    expect(rewardViews([{ kind: 'achievement', id: 'nope' }, { kind: 'quest', id: 'nope' }])).toEqual([]);
  });
  it('sums only turn xp', () => {
    expect(turnXp([{ kind: 'xp', amount: 25, source: 'turn_done' }, { kind: 'xp', amount: 3, source: 'message_sent' }])).toBe(25);
  });
});
