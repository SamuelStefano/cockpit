import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WebSocket } from 'ws';

const sent: unknown[] = [];
vi.mock('./broadcast', () => ({ send: (_ws: unknown, m: unknown) => { sent.push(m); }, broadcast: vi.fn() }));

import { sendVillage, setVillageConfig, villageView } from './village-frames';
import { updateTasks } from '../planner/store';
import { updateVillage, recordEvent } from '../village/store';

let dir: string;
const ws = {} as WebSocket;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'village-frames-'));
  process.env.COCKPIT_VILLAGE = join(dir, 'village.json');
  process.env.COCKPIT_PLANNER = join(dir, 'planner.json');
  process.env.COCKPIT_TEAM_PAUSE = join(dir, 'paused.json');
  sent.length = 0;
});
afterEach(async () => {
  for (const k of ['COCKPIT_VILLAGE', 'COCKPIT_PLANNER', 'COCKPIT_TEAM_PAUSE']) delete process.env[k];
  await rm(dir, { recursive: true, force: true });
});

describe('village frames', () => {
  it('returns ids and types only', async () => {
    await updateTasks(() => [{ id: 't1', title: 'Secret title', description: 'secret body', links: [], difficulty: 1, column: 'today', order: 1, createdAt: 1, updatedAt: 1, claim: { botId: 'bob', at: 5 } }]);
    await updateVillage((s) => recordEvent(s, { at: 9, type: 'release', botId: 'bob', taskId: 't1', reason: 'secret reason' }));
    const v = await villageView();
    expect(v.claimed).toEqual([{ botId: 'bob', taskId: 't1' }]);
    expect(v.events).toEqual([{ at: 9, type: 'release', botId: 'bob', taskId: 't1' }]);
    expect(JSON.stringify(v)).not.toContain('secret');
    await sendVillage(ws);
    expect(sent[0]).toMatchObject({ t: 'village' });
  });

  it('validates dailyCap 1..24', async () => {
    for (const bad of [0, 25, 1.5, '3', null]) await setVillageConfig(ws, bad);
    expect(sent.every((m) => (m as { t: string }).t === 'error')).toBe(true);
    sent.length = 0;
    await setVillageConfig(ws, 10);
    expect((sent[0] as { village: { dailyCap: number } }).village.dailyCap).toBe(10);
  });
});
