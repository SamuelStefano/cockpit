import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, appendFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TeamMessage } from '../shared/team-messages';
import { appendTeamLog, readTeamLog, readTeamLogSince, queryTeamLog, sentSince, isTeamPaused, setTeamPaused, teamLogFile } from './team-log';

const m = (id: string, from: string, to: string, ts: number, status: TeamMessage['status'] = 'delivered'): TeamMessage => ({ id, from, to, text: id, ts, status, hop: 1 });

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'deck-team-log-'));
  process.env.COCKPIT_TEAM_LOG = join(dir, 'log.jsonl');
  process.env.COCKPIT_TEAM_PAUSE = join(dir, 'paused.json');
});

describe('team log', () => {
  it('appends and reads back, skipping a torn line', async () => {
    await appendTeamLog(m('m1', 'a', 'b', 1));
    appendFileSync(teamLogFile(), '{"id":"broken\n');
    await appendTeamLog(m('m2', 'b', 'a', 2));
    expect((await readTeamLog()).map((x) => x.id)).toEqual(['m1', 'm2']);
  });

  it('reads only the lines added since an offset, and restarts after a rollover', async () => {
    await appendTeamLog(m('m1', 'a', 'b', 1));
    const first = await readTeamLogSince(0);
    expect(first.items.map((x) => x.id)).toEqual(['m1']);
    await appendTeamLog(m('m2', 'a', 'b', 2));
    const second = await readTeamLogSince(first.offset);
    expect(second.items.map((x) => x.id)).toEqual(['m2']);
    expect((await readTeamLogSince(second.offset)).items).toEqual([]);
    writeFileSync(teamLogFile(), `${JSON.stringify(m('m3', 'a', 'b', 3))}\n`);
    expect((await readTeamLogSince(second.offset)).items.map((x) => x.id)).toEqual(['m3']);
  });

  it('queries a bot, a pair and a page before a time', () => {
    const log = [m('1', 'a', 'b', 1), m('2', 'b', 'c', 2), m('3', 'c', 'a', 3), m('4', 'b', 'a', 4)];
    expect(queryTeamLog(log, { botId: 'a' }).map((x) => x.id)).toEqual(['1', '3', '4']);
    expect(queryTeamLog(log, { botId: 'a', peer: 'b' }).map((x) => x.id)).toEqual(['1', '4']);
    expect(queryTeamLog(log, { botId: 'a', before: 4 }).map((x) => x.id)).toEqual(['1', '3']);
    expect(queryTeamLog(log, {}, 2).map((x) => x.id)).toEqual(['3', '4']);
  });

  it('counts only what went out toward the hourly budget', () => {
    const log = [m('1', 'a', 'b', 10), m('2', 'a', 'b', 20, 'queued'), m('3', 'a', 'b', 30, 'blocked'), m('4', 'a', 'b', 5), m('5', 'b', 'a', 30)];
    expect(sentSince(log, 'a', 10)).toBe(2);
  });

  it('persists the pause switch', async () => {
    expect(isTeamPaused()).toBe(false);
    await setTeamPaused(true);
    expect(isTeamPaused()).toBe(true);
    await setTeamPaused(false);
    expect(isTeamPaused()).toBe(false);
  });
});
