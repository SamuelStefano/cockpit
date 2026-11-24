import { describe, expect, it } from 'vitest';
import type { TeamMeeting } from '../shared/team-meeting';
import { formatMeeting, formatMeetingList, parseFlags, parseMeetingStart } from './deckctl.mts';

const team = [{ id: 'a1', name: 'Ana', primary: true }, { id: 'b2', name: 'Beto' }, { id: 'c3', name: 'Caio' }];
const nameOf = (id: string) => team.find((b) => b.id === id)?.name ?? id;
const start = (args: string[]) => parseMeetingStart(team, parseFlags(args).flags);

describe('parseMeetingStart', () => {
  it('resolves names case-insensitively and defaults the moderator to the primary bot', () => {
    expect(start(['--q', 'Migrar?', '--with', 'beto, ANA'])).toEqual({ question: 'Migrar?', participantIds: ['b2', 'a1'], moderatorId: 'a1' });
  });
  it('falls back to the first participant when the primary is not in the room', () => {
    expect(start(['--q', 'x', '--with', 'beto,caio']).moderatorId).toBe('b2');
  });
  it('takes an explicit moderator, even outside the participants', () => {
    expect(start(['--q', 'x', '--with', 'ana,beto', '--moderator', 'CAIO']).moderatorId).toBe('c3');
  });
  it.each([
    ['no question', ['--with', 'ana,beto']],
    ['one bot', ['--q', 'x', '--with', 'ana']],
    ['no --with', ['--q', 'x']],
    ['unknown bot', ['--q', 'x', '--with', 'ana,zed']],
    ['unknown moderator', ['--q', 'x', '--with', 'ana,beto', '--moderator', 'zed']],
  ])('throws on %s', (_n, args) => {
    expect(() => start(args)).toThrow();
  });
});

const meeting = (over: Partial<TeamMeeting> = {}): TeamMeeting => ({
  id: 'm1abcdef', question: 'Migrar?', participantIds: ['a1', 'b2'], moderatorId: 'c3', status: 'done',
  answers: [{ botId: 'a1', round: 1, text: 'sim', at: 1 }, { botId: 'a1', round: 2, text: 'mantenho', at: 2 }], minutes: 'ata final', createdAt: 5, updatedAt: 6, ...over,
});

describe('meeting formatting', () => {
  it('lists newest first with names', () => {
    const rows = formatMeetingList([meeting({ id: 'old', createdAt: 1 }), meeting({ id: 'new', createdAt: 9 })], nameOf);
    expect(rows[0]).toContain('new');
    expect(rows[0]).toContain('Ana, Beto');
  });
  it('says so when there are none', () => {
    expect(formatMeetingList([], nameOf)).toEqual(['no meetings yet']);
  });
  it('shows rounds and minutes', () => {
    const out = formatMeeting(meeting(), nameOf).join('\n');
    expect(out).toContain('[Ana]\nsim');
    expect(out).toContain('-- round 2');
    expect(out).toContain('ata final');
  });
  it('shows a sealed round as delivered without text', () => {
    const out = formatMeeting(meeting({ status: 'round1', minutes: undefined, answers: [{ botId: 'a1', round: 1, text: '', at: 1 }] }), nameOf).join('\n');
    expect(out).toContain('[Ana] delivered, sealed');
    expect(out).toContain('(sealed)');
  });
  it('prints the failure', () => {
    expect(formatMeeting(meeting({ status: 'failed', error: 'Ana não respondeu' }), nameOf).join('\n')).toContain('error: Ana não respondeu');
  });
});
