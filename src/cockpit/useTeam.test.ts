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

describe('useTeam agent builder', () => {
  it('sends the build frame and keeps the latest result', () => {
    const { result, sent } = mount();
    const history = [{ role: 'user' as const, text: 'oi' }];
    const draft = { name: '', label: '', instructions: '', skills: [] };
    act(() => { result.current.onAgentBuild({ reqId: 'r1', history, draft }); });
    expect(sent).toEqual([{ t: 'agent-build', reqId: 'r1', history, draft }]);
    act(() => { expect(result.current.onMsg({ t: 'agent-build-result', reqId: 'r1', ok: true, text: 'olá' })).toBe(true); });
    expect(result.current.agentBuild).toEqual({ reqId: 'r1', ok: true, text: 'olá', error: undefined });
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

  it('keeps the latest team-state snapshot and asks for it', () => {
    const { result, sent } = mount();
    expect(result.current.teamState).toBeNull();
    const state = { at: 1, followUpHours: 4, bots: [], handoffs: [], followUps: [] };
    act(() => { expect(result.current.onMsg({ t: 'team-state', state })).toBe(true); });
    expect(result.current.teamState).toEqual(state);
    act(() => { result.current.onTeamStateGet(); });
    expect(sent).toEqual([{ t: 'team-state-get' }]);
  });

  it('keeps meetings newest first and upserts by id', () => {
    const { result, sent } = mount();
    const m = (id: string, createdAt: number, status: 'round1' | 'done' = 'round1') => ({ id, question: 'q', participantIds: ['a', 'b'], moderatorId: 'a', status, answers: [], createdAt, updatedAt: createdAt });
    act(() => { result.current.onMsg({ t: 'team-meetings', items: [m('m2', 2), m('m1', 1)] }); });
    act(() => { expect(result.current.onMsg({ t: 'team-meeting', item: m('m3', 3) })).toBe(true); });
    act(() => { result.current.onMsg({ t: 'team-meeting', item: m('m2', 2, 'done') }); });
    expect(result.current.meetings.map((x) => `${x.id}:${x.status}`)).toEqual(['m3:round1', 'm2:done', 'm1:round1']);
    act(() => { result.current.onMeetingsGet(); result.current.onMeetingStart({ question: 'q', participantIds: ['a', 'b'], moderatorId: 'a' }); });
    expect(sent).toEqual([{ t: 'team-meetings-get' }, { t: 'team-meeting-start', question: 'q', participantIds: ['a', 'b'], moderatorId: 'a' }]);
  });

  it('keeps the executor state and jobs from the heavy frame and sends its frames', () => {
    const { result, sent } = mount();
    expect(result.current.executor).toEqual({ configured: false, label: '', online: null });
    const jobs = [{ id: 'h1', repo: 'r', branch: 'b', command: 'c', requestedBy: 'human', status: 'queued' as const, tail: '', createdAt: 1 }];
    act(() => { expect(result.current.onMsg({ t: 'heavy', executor: { configured: true, label: 'PC', online: false }, jobs })).toBe(true); });
    expect(result.current.executor).toMatchObject({ label: 'PC', online: false });
    expect(result.current.heavyJobs).toEqual(jobs);
    act(() => { result.current.onHeavyGet(); result.current.onHeavyRun({ repo: 'r', branch: 'b', command: 'c' }); result.current.onHeavyCancel('h1'); });
    expect(sent).toEqual([{ t: 'heavy-get' }, { t: 'heavy-run', repo: 'r', branch: 'b', command: 'c' }, { t: 'heavy-cancel', id: 'h1' }]);
  });
});

describe('useTeam rotate', () => {
  it('sends the rotate frame and claims its result', () => {
    const { result, sent } = mount();
    act(() => { result.current.onTeamRotate('capo1'); });
    expect(sent).toEqual([{ t: 'team-rotate', botId: 'capo1' }]);
    act(() => { expect(result.current.onMsg({ t: 'team-rotate-result', botId: 'capo1', ok: true, words: 10 })).toBe(true); });
    act(() => { expect(result.current.onMsg({ t: 'team-rotate-result', botId: 'capo1', ok: false, error: 'rodando' })).toBe(true); });
  });
});
