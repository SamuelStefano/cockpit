import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addTurn, brtDate, emptyState, readVillage, recordEvent, sanitizeState, setDailyCap, turnsToday, updateVillage } from './store';

let dir: string;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'village-')); process.env.COCKPIT_VILLAGE = join(dir, 'village.json'); });
afterEach(async () => { delete process.env.COCKPIT_VILLAGE; await rm(dir, { recursive: true, force: true }); });

describe('village store', () => {
  it('uses the BRT date', () => {
    expect(brtDate(Date.UTC(2026, 10, 18, 2))).toBe('2026-11-17');
    expect(brtDate(Date.UTC(2026, 10, 18, 3))).toBe('2026-11-18');
  });

  it('reads defaults when the file is absent or garbage', async () => {
    expect(await readVillage()).toEqual(emptyState());
    expect(sanitizeState({ dailyCap: 999, turns: { bad: { a: 1 } }, events: [{ type: 'x' }] })).toEqual(emptyState());
  });

  it('counts turns per bot per day and keeps 7 days', async () => {
    let s = emptyState();
    for (let d = 1; d <= 9; d++) s = addTurn(s, 'bob', Date.UTC(2026, 10, d, 12));
    expect(Object.keys(s.turns)).toHaveLength(7);
    s = addTurn(s, 'bob', Date.UTC(2026, 10, 9, 13));
    expect(turnsToday(s, 'bob', Date.UTC(2026, 10, 9, 14))).toBe(2);
  });

  it('keeps the last 50 events and persists atomically', async () => {
    await updateVillage((s) => {
      let n = s;
      for (let i = 0; i < 60; i++) n = recordEvent(n, { at: i, type: 'claim', botId: 'b', taskId: `t${i}` });
      return n;
    });
    const s = await setDailyCap(3);
    expect(s.events).toHaveLength(50);
    expect(s.events[0].taskId).toBe('t10');
    expect((await readVillage()).dailyCap).toBe(3);
  });
});
