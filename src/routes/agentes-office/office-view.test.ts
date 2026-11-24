import { describe, expect, it } from 'vitest';
import type { BotView } from '../equipe/team-view';
import { buildRooms, summarize } from './office-view';

const view = (id: string, over: Partial<BotView['bot']> = {}, state: BotView['state'] = 'idle') => ({
  bot: { id, name: id, label: '', instructions: '', mascot: { shape: 'blob', color: '#fff' }, profile: 'full', createdAt: 0, updatedAt: 0, ...over },
  key: id, preview: '', unread: false, state,
}) as BotView;

describe('summarize', () => {
  it('counts agents, working (thinking or working) and waiting', () => {
    const s = summarize([view('a', {}, 'working'), view('b', {}, 'thinking'), view('c', {}, 'waiting'), view('d')]);
    expect(s).toEqual({ total: 4, working: 2, waiting: 1 });
  });
  it('is all zeros for an empty team', () => {
    expect(summarize([])).toEqual({ total: 0, working: 0, waiting: 0 });
  });
});

describe('buildRooms', () => {
  const views = [
    view('w1', { department: 'engineering', parentId: 'lead' }),
    view('x1'),
    view('lead', { department: 'engineering', primary: true }),
    view('g1', { department: 'growth' }),
  ];
  it('makes one room per used department in catalog order, no-department last', () => {
    expect(buildRooms(views).map((r) => r.key)).toEqual(['engineering', 'growth', 'none']);
  });
  it('orders desks with the lead first inside a room', () => {
    const eng = buildRooms(views)[0];
    expect(eng.entries.map((e) => e.view.bot.id)).toEqual(['lead', 'w1']);
  });
  it('marks bots that have reports as leaders', () => {
    expect(buildRooms(views)[0].leaders.has('lead')).toBe(true);
    expect(buildRooms(views)[0].leaders.has('w1')).toBe(false);
  });
  it('has no rooms for an empty team', () => {
    expect(buildRooms([])).toEqual([]);
  });
});
