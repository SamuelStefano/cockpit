// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTeam } from './useTeam';
import type { ClientMsg, TeamBot } from '../../shared/protocol';

const bot: TeamBot = { id: 'capo1', name: 'capo', label: '', instructions: '', mascot: { shape: 'drop', color: '#22c55e' }, profile: 'full', createdAt: 0, updatedAt: 0 };

const mount = () => {
  const sent: ClientMsg[] = [];
  const send = vi.fn((m: ClientMsg) => { sent.push(m); return true; });
  return { ...renderHook(() => useTeam(send)), sent };
};

describe('useTeam', () => {
  it('claims the team frame and marks loaded', () => {
    const { result } = mount();
    act(() => { expect(result.current.onMsg({ t: 'team', bots: [bot] })).toBe(true); });
    expect(result.current.bots).toEqual([bot]);
    expect(result.current.teamLoaded).toBe(true);
  });

  it('keeps the server list of open bot questions', () => {
    const { result } = mount();
    const q = { botId: 'capo1', sessionKey: 'bot-capo1', at: 1, questions: [{ question: 'Q?', header: '', multiSelect: false, options: [{ label: 'A' }] }] };
    act(() => { expect(result.current.onMsg({ t: 'team-pending', items: [q] })).toBe(true); });
    expect(result.current.pendingQuestions).toEqual([q]);
    act(() => { result.current.onMsg({ t: 'team-pending', items: [] }); });
    expect(result.current.pendingQuestions).toEqual([]);
  });

  it('ignores frames that are not its own', () => {
    const { result } = mount();
    expect(result.current.onMsg({ t: 'crons', items: [] })).toBe(false);
  });

  it('sends the three action frames', () => {
    const { result, sent } = mount();
    act(() => {
      result.current.onTeamGet();
      result.current.onTeamSave(bot);
      result.current.onTeamDelete('capo1');
    });
    expect(sent.map((m) => m.t)).toEqual(['team-get', 'team-save', 'team-delete']);
  });
});

describe('useTeam messages and pause', () => {
  const m = (id: string, ts: number) => ({ id, from: 'capo1', to: 'ativ1', text: id, ts, status: 'delivered' as const, hop: 1 });

  it('merges a page and live frames by id, in time order', () => {
    const { result } = mount();
    act(() => { result.current.onMsg({ t: 'team-messages', items: [m('m2', 2), m('m1', 1)] }); });
    act(() => { result.current.onMsg({ t: 'team-message', item: m('m3', 3) }); });
    act(() => { result.current.onMsg({ t: 'team-message', item: { ...m('m2', 2), status: 'queued' } }); });
    expect(result.current.teamMessages.map((x) => `${x.id}:${x.status}`)).toEqual(['m1:delivered', 'm2:queued', 'm3:delivered']);
  });

  it('tracks the pause switch and sends both frames', () => {
    const { result, sent } = mount();
    act(() => { result.current.onMsg({ t: 'team-paused', paused: true }); });
    expect(result.current.teamPaused).toBe(true);
    act(() => {
      result.current.onTeamPauseSet(false);
      result.current.onTeamMessagesGet({ botId: 'capo1', peer: 'ativ1' });
    });
    expect(sent).toEqual([{ t: 'team-pause-set', paused: false }, { t: 'team-messages-get', botId: 'capo1', peer: 'ativ1' }]);
  });
});
