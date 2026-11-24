import { appendFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamMessage } from '../shared/team-messages';

const since = vi.hoisted(() => ({ calls: [] as number[] }));
vi.mock('./team-log', async (orig) => {
  const real = await orig<typeof import('./team-log')>();
  return { ...real, readTeamLogSince: (o: number) => { since.calls.push(o); return real.readTeamLogSince(o); } };
});

import { _resetTeamStateCache, readTasksCached, readTeamLogCached } from './team-state-cache';

const line = (id: string, ts: number): string => `${JSON.stringify({ id, from: 'a', to: 'b', text: id, ts, status: 'delivered', hop: 1 } satisfies TeamMessage)}\n`;
let logFile = '';
let boardFile = '';

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'deck-state-cache-'));
  logFile = join(dir, 'log.jsonl');
  boardFile = join(dir, 'planner.json');
  process.env.COCKPIT_TEAM_LOG = logFile;
  process.env.COCKPIT_PLANNER = boardFile;
  since.calls.length = 0;
  _resetTeamStateCache();
});

describe('readTeamLogCached', () => {
  it('reads only the appended bytes on the next call', async () => {
    writeFileSync(logFile, line('m1', 1) + line('m2', 2));
    expect((await readTeamLogCached()).map((m) => m.id)).toEqual(['m1', 'm2']);
    appendFileSync(logFile, line('m3', 3));
    expect((await readTeamLogCached()).map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(since.calls[0]).toBe(0);
    expect(since.calls[1]).toBeGreaterThan(0);
    expect((await readTeamLogCached()).map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('starts over when the file rolled over to a shorter one', async () => {
    writeFileSync(logFile, line('m1', 1) + line('m2', 2));
    await readTeamLogCached();
    writeFileSync(logFile, line('m9', 9));
    expect((await readTeamLogCached()).map((m) => m.id)).toEqual(['m9']);
  });
});

describe('readTasksCached', () => {
  it('re-reads the board only when its file changed', async () => {
    writeFileSync(boardFile, JSON.stringify({ tasks: [{ id: 't1', title: 'one', column: 'today' }] }));
    const first = await readTasksCached();
    expect(await readTasksCached()).toBe(first);
    writeFileSync(boardFile, JSON.stringify({ tasks: [{ id: 't1', title: 'one', column: 'today' }, { id: 't2', title: 'two', column: 'week' }] }));
    expect((await readTasksCached()).map((t) => t.id)).toEqual(['t1', 't2']);
  });
});
