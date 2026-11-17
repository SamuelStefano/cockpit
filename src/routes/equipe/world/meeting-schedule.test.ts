import { describe, it, expect } from 'vitest';
import { meetingCommand, meetingCron, parseTime } from './meeting-schedule';

const input = { question: "what's next for Itera?", participantIds: ['a', 'b'], moderatorId: 'a' };
const names = { a: 'Luffy', b: 'Zoro' };

describe('meeting schedule', () => {
  it('builds the deckctl command with shell-safe quoting', () => {
    expect(meetingCommand(input, names)).toBe(`deckctl meeting start --q 'what'\\''s next for Itera?' --with 'Luffy,Zoro' --moderator 'Luffy'`);
  });

  it('parses a time of day', () => {
    expect(parseTime('09:30')).toBe(570);
    expect(parseTime('9:05')).toBe(545);
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('nope')).toBeNull();
  });

  it('makes a daily cron that runs the meeting command', () => {
    const r = meetingCron(input, names, '09:30', 1_700_000_000_000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cron.schedule).toEqual({ kind: 'daily', atMinute: 570 });
    expect(r.cron.prompt).toContain('deckctl meeting start --q');
    expect(r.cron.enabled).toBe(true);
    expect(/^[a-zA-Z0-9_-]{1,59}$/.test(r.cron.id)).toBe(true);
  });

  it('rejects a bad time or an empty question', () => {
    expect(meetingCron(input, names, 'x', 1).ok).toBe(false);
    expect(meetingCron({ ...input, question: '' }, names, '09:00', 1).ok).toBe(false);
  });
});
