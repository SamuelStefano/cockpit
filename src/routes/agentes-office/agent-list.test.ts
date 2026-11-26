import { describe, expect, it } from 'vitest';
import type { BotView } from '../equipe/team-view';
import { agentMeta, agentRowsOf, filterBySector, sectorChips } from './agent-list';

const view = (id: string, over: Partial<BotView['bot']> = {}) => ({
  bot: { id, name: id, label: '', instructions: '', mascot: { shape: 'blob', color: '#3b82f6' }, profile: 'full', createdAt: 0, updatedAt: 0, ...over },
  key: id, preview: '', unread: false, state: 'idle',
}) as BotView;

const views = [view('a', { department: 'engineering', model: 'sonnet' }), view('b', { department: 'growth', parentId: 'a' }), view('c')];

describe('agent-list', () => {
  it('builds chips only for used sectors, plus Sem setor', () => {
    expect(sectorChips(views).map((c) => c.label)).toEqual(['Todos', 'Engenharia', 'Growth', 'Sem setor']);
    expect(sectorChips([views[0]]).map((c) => c.label)).toEqual(['Todos', 'Engenharia']);
  });

  it('filters by sector', () => {
    expect(filterBySector(views, 'all')).toHaveLength(3);
    expect(filterBySector(views, 'growth').map((v) => v.bot.id)).toEqual(['b']);
    expect(filterBySector(views, 'none').map((v) => v.bot.id)).toEqual(['c']);
  });

  it('marks leaders from the full team even when filtered', () => {
    expect(agentRowsOf(filterBySector(views, 'engineering'), views)[0].isLeader).toBe(true);
  });

  it('joins sector and model in the meta line', () => {
    expect(agentMeta(views[0])).toBe('Engenharia · sonnet');
    expect(agentMeta(views[2])).toBe('Sem setor');
  });
});
