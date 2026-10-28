import { describe, it, expect } from 'vitest';
import type { Cron, TeamBotInput } from '../../shared/protocol';
import { coerceBotForRole, visibleCrons, cronWriteError, coerceCronForRole } from './student-team';

const bot: TeamBotInput = { id: 'capo1', name: 'capo', label: '', instructions: '', mascot: { shape: 'drop', color: '#22c55e' }, profile: 'full', mode: 'acceptEdits', model: 'agent:grok' };
const routine: Cron = { id: 'r1', name: 'x', prompt: 'p', schedule: { kind: 'interval', everyMinutes: 5 }, enabled: true, createdAt: 1, botId: 'capo1', mode: 'acceptEdits' };
const free: Cron = { ...routine, id: 'f1', botId: undefined };

describe('coerceBotForRole', () => {
  it('student: restricted, auto, no ACP agent', () => {
    const b = coerceBotForRole(bot, 'student');
    expect(b).toMatchObject({ profile: 'restricted', mode: 'auto' });
    expect(b.model).toBeUndefined();
    expect(coerceBotForRole({ ...bot, model: 'haiku' }, 'student').model).toBe('haiku');
  });
  it('admin: untouched', () => {
    expect(coerceBotForRole(bot, 'admin')).toBe(bot);
  });
});

describe('cron rules for a non-admin', () => {
  it('visibleCrons hides free crons', () => {
    expect(visibleCrons([routine, free], 'student')).toEqual([routine]);
    expect(visibleCrons([routine, free], 'admin')).toEqual([routine, free]);
  });
  it('cronWriteError refuses a free or missing cron', () => {
    expect(cronWriteError(routine, 'student')).toBeNull();
    expect(cronWriteError(free, 'student')).not.toBeNull();
    expect(cronWriteError(undefined, 'student')).not.toBeNull();
    expect(cronWriteError(undefined, 'admin')).toBeNull();
  });
  it('coerceCronForRole pins mode and refuses overwriting a free cron', () => {
    expect(coerceCronForRole({ ...routine, model: 'agent:grok' }, undefined, 'student')).toEqual({ cron: { ...routine, mode: 'auto' } });
    expect(coerceCronForRole({ ...routine, id: 'f1' }, free, 'student')).toEqual({ error: expect.any(String) });
    expect(coerceCronForRole(free, undefined, 'student')).toEqual({ error: expect.any(String) });
    expect(coerceCronForRole(free, undefined, 'admin')).toEqual({ cron: free });
  });
});

describe('coerceBotForRole permissions', () => {
  const perms = { read: true, write: true, net: true };
  it('a non-admin cannot grant write', () => {
    expect(coerceBotForRole({ ...bot, permissions: perms }, 'student').permissions).toEqual({ read: true, write: false, net: true });
  });
  it('leaves absent permissions absent', () => {
    expect(coerceBotForRole(bot, 'student').permissions).toBeUndefined();
  });
  it('admin keeps what was sent', () => {
    expect(coerceBotForRole({ ...bot, permissions: perms }, 'admin').permissions).toEqual(perms);
  });
});
