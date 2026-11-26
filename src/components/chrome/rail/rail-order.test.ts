import { describe, expect, it } from 'vitest';
import type { BotView } from '../../../routes/equipe/team-view';
import type { TeamBot } from '../../../../shared/protocol';
import { canOpen, railAgents, railStatus, railTone, workRoute } from './rail-order';

function view(id: string, over: Partial<BotView> = {}): BotView {
  const bot = { id, name: id, label: '', instructions: '', mascot: { shape: 'blob', color: '#fff' }, profile: 'restricted', createdAt: 0, updatedAt: 0 } as unknown as TeamBot;
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

describe('railStatus', () => {
  it('maps the bot state to the avatar dot', () => {
    expect(railStatus(view('a', { state: 'working' }))).toBe('ok');
    expect(railStatus(view('a', { state: 'thinking' }))).toBe('ok');
    expect(railStatus(view('a', { state: 'waiting' }))).toBe('warn');
    expect(railStatus(view('a', { state: 'error' }))).toBe('err');
    expect(railStatus(view('a'))).toBeUndefined();
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
