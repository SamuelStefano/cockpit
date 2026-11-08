import { describe, it, expect } from 'vitest';
import type { BotView } from '../../routes/equipe/team-view';
import { foldTeam } from './fold-team';

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
