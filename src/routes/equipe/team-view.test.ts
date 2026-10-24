import { describe, it, expect } from 'vitest';
import { botView, botChatKey, orderBots, lastTrafficByBot, type TeamViewCtx } from './team-view';
import type { TeamBot } from '../../../shared/protocol';
import type { Session } from '../../data/types';

const SID = '11111111-1111-1111-1111-111111111111';
const mk = (id: string, over: Partial<TeamBot> = {}): TeamBot => ({
  id, name: id, label: 'cargo', instructions: '', mascot: { shape: 'blob', color: '#22c55e' }, profile: 'full', createdAt: 0, updatedAt: 0, ...over,
});
const session = (id: string, over: Partial<Session> = {}): Session => ({ id, title: 't', relative: '', snippet: 'última fala', mtime: 500, hasTerminal: false, active: false, ...over });
const ctx = (over: Partial<TeamViewCtx> = {}): TeamViewCtx => ({
  sessions: [], running: new Set(), activeId: '', phase: 'idle', interrupted: {}, runStart: {}, seen: {}, selectedId: null, now: 1000, ...over,
});

describe('botChatKey / orderBots', () => {
  it('uses the bound session, else the draft key', () => {
    expect(botChatKey(mk('capo1', { sessionId: SID }))).toBe(SID);
    expect(botChatKey(mk('capo1'))).toBe('new-bot-capo1');
  });
  it('puts the primary first, then creation order', () => {
    const order = orderBots([mk('b', { createdAt: 2 }), mk('a', { createdAt: 3, primary: true }), mk('c', { createdAt: 1 })]);
    expect(order.map((b) => b.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('botView', () => {
  const bot = mk('capo1', { sessionId: SID });
  it('previews the last message and flags unread past the seen mark', () => {
    const v = botView(bot, ctx({ sessions: [session(SID)], seen: { capo1: 100 } }));
    expect(v.preview).toBe('última fala');
    expect(v.unread).toBe(true);
    expect(botView(bot, ctx({ sessions: [session(SID)], seen: { capo1: 600 } })).unread).toBe(false);
  });
  it('the selected bot is never unread', () => {
    expect(botView(bot, ctx({ sessions: [session(SID)], selectedId: 'capo1' })).unread).toBe(false);
  });
  it('falls back to the label before the first message', () => {
    expect(botView(mk('capo1'), ctx()).preview).toBe('cargo');
  });
  it('derives the mascot from the live session state', () => {
    expect(botView(bot, ctx({ running: new Set([SID]), activeId: SID, phase: 'thinking' })).state).toBe('thinking');
    expect(botView(bot, ctx({ running: new Set([SID]) })).state).toBe('working');
    expect(botView(bot, ctx({ sessions: [session(SID, { waiting: true })] })).state).toBe('waiting');
    expect(botView(bot, ctx({ interrupted: { [SID]: 'max_turns' } })).state).toBe('blocked');
    expect(botView(bot, ctx({ sessions: [session(SID, { lastTurnOk: true, mtime: 900 })] })).state).toBe('done');
  });
});

describe('traffic preview', () => {
  const m = (id: string, from: string, to: string, ts: number) => ({ id, from, to, text: `t${id}`, ts, status: 'delivered' as const, hop: 1 });
  const nameOf = (id: string) => id.toUpperCase();

  it('keeps the newest message per bot, sender and recipient alike', () => {
    const last = lastTrafficByBot([m('1', 'a', 'b', 1), m('2', 'c', 'a', 2)]);
    expect(last.a.id).toBe('2');
    expect(last.b.id).toBe('1');
    expect(last.c.id).toBe('2');
  });

  it('previews a newer bot message over the thread snippet', () => {
    const bot = mk('lead1', { sessionId: SID });
    const v = botView(bot, ctx({ sessions: [session(SID, { mtime: 500 })], lastTraffic: { lead1: m('1', 'lead1', 'ativ1', 900) }, nameOf }));
    expect(v.preview).toBe('Mandou para ATIV1: t1');
    const older = botView(bot, ctx({ sessions: [session(SID, { mtime: 500 })], lastTraffic: { lead1: m('1', 'ativ1', 'lead1', 100) }, nameOf }));
    expect(older.preview).toBe('última fala');
  });
});
