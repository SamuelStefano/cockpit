import { describe, it, expect } from 'vitest';
import { meetingCron, meetingCronId, parseTime } from './meeting-schedule';

const input = { question: "what's next for Itera?", participantIds: ['a', 'b'], moderatorId: 'a' };

describe('meeting schedule', () => {
  it('parses a time of day', () => {
    expect(parseTime('09:30')).toBe(570);
    expect(parseTime('9:05')).toBe(545);
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('nope')).toBeNull();
  });

  it('makes a daily cron with a server-side meeting action', () => {
    const r = meetingCron(input, '09:30', 1_700_000_000_000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cron.schedule).toEqual({ kind: 'daily', atMinute: 570 });
    expect(r.cron.action).toEqual({ kind: 'team-meeting', ...input });
    expect(r.cron.prompt).not.toContain('deckctl');
    expect(r.cron.enabled).toBe(true);
    expect(/^[a-zA-Z0-9_-]{1,59}$/.test(r.cron.id)).toBe(true);
  });

  it('derives a stable id independent of participant order', () => {
    const id = meetingCronId(input, '09:30');
    expect(meetingCronId({ ...input, participantIds: ['b', 'a'] }, '09:30')).toBe(id);
    expect(meetingCron(input, '09:30', 1).ok && meetingCronId(input, '09:30')).toBe(id);
    expect(meetingCronId(input, '10:00')).not.toBe(id);
    expect(meetingCronId({ ...input, participantIds: ['a', 'c'] }, '09:30')).not.toBe(id);
    expect(meetingCronId({ ...input, moderatorId: 'b' }, '09:30')).not.toBe(id);
  });

  it('rejects a bad time or an empty question', () => {
    expect(meetingCron(input, 'x', 1).ok).toBe(false);
    expect(meetingCron({ ...input, question: '' }, '09:00', 1).ok).toBe(false);
  });
});
