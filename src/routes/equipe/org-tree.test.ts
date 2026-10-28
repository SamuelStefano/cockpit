import { describe, it, expect } from 'vitest';
import { buildOrgTree, todayCounts } from './org-tree';
import type { BotView } from './team-view';

const v = (id: string, over: Partial<BotView['bot']> = {}, state: BotView['state'] = 'idle'): BotView => ({
  bot: { id, name: id, label: '', instructions: '', mascot: { shape: 'blob', color: '#fff' }, profile: 'full', createdAt: 0, updatedAt: 0, ...over },
  key: id, preview: '', unread: false, state,
});

describe('buildOrgTree', () => {
  it('nests by parentId and roots orphans and missing parents', () => {
    const t = buildOrgTree([v('a', { primary: true }), v('b', { parentId: 'a' }), v('c', { parentId: 'b' }), v('d', { parentId: 'gone' })]);
    expect(t.map((x) => x.view.bot.id)).toEqual(['a', 'd']);
    expect(t[0].children[0].children[0].view.bot.id).toBe('c');
  });
  it('survives a cycle without dropping or repeating bots', () => {
    const t = buildOrgTree([v('a', { parentId: 'b' }), v('b', { parentId: 'a' })]);
    const flat = (n: typeof t): string[] => n.flatMap((x) => [x.view.bot.id, ...flat(x.children)]);
    expect(flat(t).sort()).toEqual(['a', 'b']);
  });
});

describe('todayCounts', () => {
  it('counts live and waiting bots, cost only when today has a bucket', () => {
    const now = new Date(2026, 9, 28, 12).getTime();
    const day = new Date(2026, 9, 28).getTime();
    const views = [v('a', {}, 'working'), v('b', {}, 'thinking'), v('c', {}, 'waiting'), v('d')];
    expect(todayCounts(views, [{ day, cost: 0.8 }], now)).toEqual({ working: 2, waiting: 1, costUsd: 0.8 });
    expect(todayCounts(views, [], now).costUsd).toBeUndefined();
    expect(todayCounts(views, undefined, now).costUsd).toBeUndefined();
  });
});
