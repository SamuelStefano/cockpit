import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Cron, TeamBot } from '../../shared/protocol';
import type { MeetingDeps } from '../team-meetings';
import { fireMeetingAction, validateCronAction } from './cron-fire';

const bot = (id: string, name: string): TeamBot => ({
  id, name, label: 'l', instructions: 'i', mascot: { shape: 'drop', color: '#fff' }, profile: 'restricted', createdAt: 1, updatedAt: 1,
});
const team = [bot('a1', 'Ana'), bot('b2', 'Beto')];
const action = { kind: 'team-meeting' as const, question: 'Ship it?', participantIds: ['a1', 'b2'], moderatorId: 'a1' };
const cron: Cron = { id: 'meeting-x', name: 'm', prompt: 'm', schedule: { kind: 'daily', atMinute: 540 }, enabled: true, createdAt: 1, action };

let dir: string;
let asks = 0;
const deps = (over: Partial<MeetingDeps> = {}): MeetingDeps => ({
  ask: async () => { asks++; return 'reply'; },
  getTeam: async () => team,
  isPaused: () => false,
  hasRoom: () => true,
  publish: () => {},
  now: () => 100,
  newId: () => 'm1',
  ...over,
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cf-'));
  process.env.COCKPIT_TEAM_MEETINGS = join(dir, 'team-meetings.json');
  asks = 0;
});
afterEach(() => { delete process.env.COCKPIT_TEAM_MEETINGS; rmSync(dir, { recursive: true, force: true }); });

describe('fireMeetingAction', () => {
  it('starts the meeting from the participant ids, with no prompt turn', async () => {
    expect(await fireMeetingAction(cron, deps())).toBe('started');
    await new Promise((r) => setTimeout(r, 100));
  });

  it('returns a visible failure instead of staying silent', async () => {
    const r = await fireMeetingAction(cron, deps({ isPaused: () => true }));
    expect(r).toEqual({ outcome: 'failed', error: 'a equipe está pausada' });
  });

  it('fails when a participant no longer exists', async () => {
    const r = await fireMeetingAction({ ...cron, action: { ...action, participantIds: ['a1', 'gone'] } }, deps());
    expect(typeof r === 'object' && r.outcome).toBe('failed');
  });

  it('skips a cron with no action', async () => {
    expect(await fireMeetingAction({ ...cron, action: undefined }, deps())).toBe('skipped');
  });
});

describe('validateCronAction', () => {
  it('is admin only', () => {
    expect(validateCronAction(action, 'student', team)).toEqual({ ok: false, error: 'só o admin agenda reunião' });
    expect(validateCronAction(action, undefined, team).ok).toBe(false);
    expect(validateCronAction(action, 'admin', team).ok).toBe(true);
  });

  it('rejects an unknown kind, bad ids and an empty question', () => {
    expect(validateCronAction({ ...action, kind: 'shell' }, 'admin', team).ok).toBe(false);
    expect(validateCronAction({ ...action, participantIds: ['a1', 'zz'] }, 'admin', team).ok).toBe(false);
    expect(validateCronAction({ ...action, question: ' ' }, 'admin', team).ok).toBe(false);
  });

  it('drops extra fields from the stored action', () => {
    const r = validateCronAction({ ...action, command: 'rm -rf /' }, 'admin', team);
    expect(r.ok && Object.keys(r.action).sort()).toEqual(['kind', 'moderatorId', 'participantIds', 'question']);
  });
});
