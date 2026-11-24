import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TeamBot } from '../../shared/protocol';

process.env.COCKPIT_PLANNER = join(mkdtempSync(join(tmpdir(), 'deck-handoff-')), 'planner.json');
const { updateTasks, readTasks } = await import('../planner/store');
const { applyBotHandoff } = await import('./team-handoff');

const bot = (id: string, name: string): TeamBot => ({ id, name, label: '', instructions: '', mascot: { shape: 'drop', color: '#22c55e' }, profile: 'full', createdAt: 1, updatedAt: 1 });
const team = [bot('a', 'Ana'), bot('b', 'Beto')];
const handoff = { taskId: 't1', done: 'd', pending: 'p', reason: 'r', switchPoint: 's' };
const seed = (ownerBotId?: string) => updateTasks(() => [{ id: 't1', title: 'Tarefa', description: '', links: [], difficulty: 1, column: 'today', order: 1, createdAt: 1, updatedAt: 1, ...(ownerBotId ? { ownerBotId } : {}) }]);

beforeEach(async () => { await seed('a'); });

describe('applyBotHandoff', () => {
  it('persists the new owner and history, and renders the note', async () => {
    const r = await applyBotHandoff({ from: 'a', to: 'b', handoff }, team, 99);
    expect(r.ok && r.text).toContain('Ana passou para Beto');
    const [t] = await readTasks();
    expect(t.ownerBotId).toBe('b');
    expect(t.handoffs).toEqual([{ at: 99, fromBotId: 'a', toBotId: 'b', done: 'd', pending: 'p', reason: 'r', switchPoint: 's' }]);
  });

  it('refuses a caller that is not the owner and leaves the task alone', async () => {
    const r = await applyBotHandoff({ from: 'b', to: 'a', handoff }, team);
    expect(r.ok).toBe(false);
    expect((await readTasks())[0].ownerBotId).toBe('a');
  });

  it('accepts an unowned task and reports a missing one', async () => {
    await seed();
    expect((await applyBotHandoff({ from: 'a', to: 'b', handoff }, team)).ok).toBe(true);
    expect((await applyBotHandoff({ from: 'b', to: 'a', handoff: { ...handoff, taskId: 'zz' } }, team)).ok).toBe(false);
  });
});
