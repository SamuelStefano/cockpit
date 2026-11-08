import { describe, it, expect } from 'vitest';
import type { BotView } from '../../routes/equipe/team-view';
import { foldTeam, glanceEntries } from './fold-team';
import type { TeamEntry } from './team-order';

const e = (id: string, depth: number) => ({ view: { bot: { id } } as unknown as BotView, depth });
const entries = [e('chief', 0), e('lead', 1), e('w1', 2), e('w2', 2), e('solo', 1), e('other', 0)];
const ids = (r: ReturnType<typeof foldTeam>) => r.visible.map((x) => x.view.bot.id);

describe('foldTeam', () => {
  it('hides every descendant of a closed lead and counts them', () => {
    const r = foldTeam(entries, new Set());
    expect(ids(r)).toEqual(['chief', 'other']);
    expect(r.counts).toEqual({ chief: 4 });
  });

  it('shows one level when only the parent is open', () => {
    expect(ids(foldTeam(entries, new Set(['chief'])))).toEqual(['chief', 'lead', 'solo', 'other']);
  });

  it('shows everything when all leads are open', () => {
    expect(ids(foldTeam(entries, new Set(['chief', 'lead'])))).toHaveLength(6);
  });
});

describe('glanceEntries', () => {
  const g = (id: string, depth: number, extra: Record<string, unknown> = {}) =>
    ({ depth, view: { bot: { id }, state: 'idle', unread: false, ...extra } }) as unknown as TeamEntry;

  it('keeps the open, working, thinking and unread agents, flattened', () => {
    const r = glanceEntries([g('a', 0), g('b', 1, { state: 'working' }), g('c', 2, { state: 'thinking' }), g('d', 1, { unread: true }), g('x', 1)], 'a');
    expect(r.map((x) => [x.view.bot.id, x.depth])).toEqual([['a', 0], ['b', 0], ['c', 0], ['d', 0]]);
  });
});
