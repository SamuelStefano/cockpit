import { describe, it, expect } from 'vitest';
import type { BotView } from '../../routes/equipe/team-view';
import { agoLabel, earliestStart, rowStatus, teamIsWorking, teamRows } from './team-working';

const v = (id: string, state: BotView['state'], over: Partial<BotView> = {}): BotView => ({
  bot: { id, name: id, label: '', instructions: '', mascot: { shape: 'blob', color: '#fff' }, profile: 'full', createdAt: 0, updatedAt: 0 },
  key: id, preview: '', unread: false, state, ...over,
});

describe('team-working', () => {
  it('lists everyone but the capo', () => {
    expect(teamRows([v('capo', 'idle'), v('a', 'idle'), v('b', 'idle')], 'capo').map((r) => r.bot.id)).toEqual(['a', 'b']);
  });
  it('is working while one member thinks, works or waits', () => {
    expect(teamIsWorking([v('a', 'idle'), v('b', 'done'), v('c', 'error')])).toBe(false);
    for (const s of ['thinking', 'working', 'waiting'] as const) expect(teamIsWorking([v('a', 'idle'), v('b', s)])).toBe(true);
  });
  it('starts counting from the earliest live turn', () => {
    expect(earliestStart([v('a', 'working', { startedAt: 500 }), v('b', 'thinking', { startedAt: 200 }), v('c', 'done', { startedAt: 1 })])).toBe(200);
    expect(earliestStart([v('a', 'idle')])).toBeUndefined();
  });
  it('words the elapsed time and the idle phrase', () => {
    expect(agoLabel(0, 30_000)).toBe('agora');
    expect(agoLabel(0, 3 * 60_000)).toBe('há 3 min');
    expect(agoLabel(0, 125 * 60_000)).toBe('há 2 h');
    expect(rowStatus(v('a', 'idle'))).toEqual({ phrase: 'Livre', faint: true });
    expect(rowStatus(v('a', 'thinking')).phrase).toBeUndefined();
  });
});
