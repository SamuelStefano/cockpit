import { describe, it, expect } from 'vitest';
import { QUESTS, questsForDay, DAILY_QUEST_COUNT } from './quests';

describe('questsForDay', () => {
  it('is deterministic for a day', () => {
    expect(questsForDay('2026-10-30').map((q) => q.id)).toEqual(questsForDay('2026-10-30').map((q) => q.id));
  });
  it('returns 3 distinct quests', () => {
    const ids = questsForDay('2026-10-30').map((q) => q.id);
    expect(ids).toHaveLength(DAILY_QUEST_COUNT);
    expect(new Set(ids).size).toBe(DAILY_QUEST_COUNT);
  });
  it('varies across days', () => {
    const sets = new Set<string>();
    for (let d = 1; d <= 28; d++) sets.add(questsForDay(`2026-02-${String(d).padStart(2, '0')}`).map((q) => q.id).join());
    expect(sets.size).toBeGreaterThan(10);
  });
  it('has a unique id per quest', () => {
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
  });
});
