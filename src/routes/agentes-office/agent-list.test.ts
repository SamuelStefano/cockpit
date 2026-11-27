import { describe, expect, it } from 'vitest';
import type { BotView } from '../equipe/team-view';
import { agentMeta, agentRowsOf, copyInput, copyName, filterBySearch, filterBySector, filterByStatus, sectorChips, statusChips } from './agent-list';

const view = (id: string, over: Partial<BotView['bot']> = {}, state: BotView['state'] = 'idle') => ({
  bot: { id, name: id, label: '', instructions: '', mascot: { shape: 'blob', color: '#3b82f6' }, profile: 'full', createdAt: 0, updatedAt: 0, ...over },
  key: id, preview: '', unread: false, state,
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

  const states = [view('t', {}, 'thinking'), view('w', {}, 'working'), view('q', {}, 'waiting'), view('e', {}, 'error'), view('i', {}, 'idle')];

  it('filters by status and counts per chip', () => {
    expect(filterByStatus(states, 'working').map((v) => v.bot.id)).toEqual(['t', 'w']);
    expect(filterByStatus(states, 'waiting').map((v) => v.bot.id)).toEqual(['q']);
    expect(filterByStatus(states, 'all')).toHaveLength(5);
    expect(statusChips(states).map((c) => `${c.label}:${c.count}`)).toEqual(['Todos:5', 'Trabalhando:2', 'Esperando você:1', 'Com erro:1', 'À toa:1']);
  });

  it('searches name, label and model case-insensitively', () => {
    const t = [view('alpha', { label: 'Revisor de PR' }), view('beta', { model: 'Sonnet' })];
    expect(filterBySearch(t, 'REVISOR').map((v) => v.bot.id)).toEqual(['alpha']);
    expect(filterBySearch(t, 'sonn').map((v) => v.bot.id)).toEqual(['beta']);
    expect(filterBySearch(t, 'BET').map((v) => v.bot.id)).toEqual(['beta']);
    expect(filterBySearch(t, '  ')).toHaveLength(2);
    expect(filterBySearch(t, 'zzz')).toHaveLength(0);
  });

  it('names copies uniquely within the name rules', () => {
    const bots = [view('a').bot, view('a-copia').bot];
    expect(copyName('a', bots)).toBe('a-copia-2');
    expect(copyName('b', bots)).toBe('b-copia');
    expect(copyName('x'.repeat(40), []).length).toBeLessThanOrEqual(40);
  });

  it('builds a copy input without identity, session or primary flag', () => {
    const src = { ...view('a', { primary: true, model: 'sonnet', sessionId: 's1', previousSessionIds: ['s0'], source: { repo: 'r', path: 'p' } }).bot };
    const c = copyInput(src, [src]);
    expect(c.id).not.toBe('a');
    expect(c.name).toBe('a-copia');
    expect(c.model).toBe('sonnet');
    expect(c).not.toHaveProperty('primary');
    expect(c).not.toHaveProperty('sessionId');
    expect(c).not.toHaveProperty('previousSessionIds');
    expect(c).not.toHaveProperty('source');
  });
});
