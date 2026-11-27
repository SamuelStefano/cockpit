import { describe, expect, it } from 'vitest';
import type { BotView } from '../../../routes/equipe/team-view';
import type { TeamBot } from '../../../../shared/protocol';
import { canOpen, railAgents, railStatus, railTone, workRoute } from './rail-order';

function view(id: string, over: Partial<BotView> = {}, parentId?: string): BotView {
  const bot = { id, name: id, parentId, label: '', instructions: '', mascot: { shape: 'blob', color: '#fff' }, profile: 'restricted', createdAt: 0, updatedAt: 0 } as unknown as TeamBot;
  return { bot, key: id, preview: '', unread: false, state: 'idle', ...over };
}

describe('railAgents', () => {
  it('puts working and waiting agents first, then the most recent', () => {
    const views = [view('a', { endedAt: 1 }), view('b', { endedAt: 9 }), view('c', { state: 'working', endedAt: 0 }), view('d', { pending: { botId: 'd' } as BotView['pending'] })];
    expect(railAgents(views, null).shown.map((v) => v.bot.id)).toEqual(['c', 'd', 'b', 'a']);
  });

  it('caps the rail and counts the rest', () => {
    const views = Array.from({ length: 10 }, (_, i) => view(`b${i}`, { endedAt: i }));
    const r = railAgents(views, null);
    expect(r.shown).toHaveLength(7);
    expect(r.hidden).toBe(3);
  });

  it('keeps the selected agent visible even when it would overflow', () => {
    const views = Array.from({ length: 10 }, (_, i) => view(`b${i}`, { endedAt: i }));
    const r = railAgents(views, 'b0');
    expect(r.shown.map((v) => v.bot.id)).toContain('b0');
    expect(r.shown).toHaveLength(7);
  });
});

describe('railAgents hierarchy', () => {
  const filler = (n: number) => Array.from({ length: n }, (_, i) => view(`f${i}`, { endedAt: 100 - i }));

  it('seats the chief of a shown sub-agent, swapping out the last free seat', () => {
    const views = [view('kid', { state: 'working' }, 'chief'), ...filler(7), view('chief', { endedAt: 0 })];
    const ids = railAgents(views, null).shown.map((v) => v.bot.id);
    expect(ids).toHaveLength(7);
    expect(ids.indexOf('chief')).toBe(ids.indexOf('kid') - 1);
    expect(ids).not.toContain('f5');
  });

  it('places a sub-agent right after its chief', () => {
    const views = [view('a', { endedAt: 9 }), view('kid', { endedAt: 1 }, 'chief'), view('b', { endedAt: 8 }), view('chief', { endedAt: 5 })];
    expect(railAgents(views, null).shown.map((v) => v.bot.id)).toEqual(['a', 'b', 'chief', 'kid']);
  });

  it('keeps the selected seat while seating the chief', () => {
    const views = [view('kid', { state: 'working' }, 'chief'), ...filler(7), view('chief', { endedAt: 0 })];
    const ids = railAgents(views, 'f6').shown.map((v) => v.bot.id);
    expect(ids).toContain('f6');
    expect(ids).toContain('chief');
    expect(ids).toContain('kid');
  });
});

describe('railStatus', () => {
  it('maps the bot state to the avatar dot', () => {
    expect(railStatus(view('a', { state: 'working' }))).toBe('ok');
    expect(railStatus(view('a', { state: 'thinking' }))).toBe('ok');
    expect(railStatus(view('a', { state: 'waiting' }))).toBe('warn');
    expect(railStatus(view('a', { state: 'error' }))).toBe('err');
    expect(railStatus(view('a'))).toBeUndefined();
  });

  it('shows the unread mark only when nothing stronger applies', () => {
    expect(railStatus(view('a', { unread: true }))).toBe('info');
    expect(railStatus(view('a', { unread: true, state: 'working' }))).toBe('ok');
    expect(railStatus(view('a', { unread: true, state: 'error' }))).toBe('err');
    expect(railStatus(view('a', { unread: true, state: 'waiting' }))).toBe('warn');
  });
});

describe('railTone', () => {
  it('is deterministic per id', () => {
    expect(railTone('bot-1')).toBe(railTone('bot-1'));
  });
});

describe('role targets', () => {
  it('sends Trabalho to the first work route the role may open', () => {
    expect(workRoute('root')).toBe('/canvas');
    expect(workRoute('admin')).toBe('/canvas');
    expect(workRoute('student')).toBeNull();
  });

  it('never opens a route outside the role menu', () => {
    expect(canOpen('student', '/equipe')).toBe(false);
    expect(canOpen('student', '/explorar')).toBe(false);
    expect(canOpen('admin', '/explorar')).toBe(true);
  });
});
