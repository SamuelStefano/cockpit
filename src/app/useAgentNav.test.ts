// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentNav, type AgentNavInput } from './useAgentNav';
import type { TeamBot } from '../../shared/protocol';
import type { Route } from '../useRoute';

beforeEach(() => localStorage.clear());

const bot = (id: string, over: Partial<TeamBot> = {}) => ({ id, name: id, label: '', instructions: '', mascot: { shape: 'drop', color: '#fff' }, profile: 'full', createdAt: 0, updatedAt: 0, ...over }) as TeamBot;

function input(over: Partial<AgentNavInput> = {}): AgentNavInput {
  return {
    bots: [bot('ana01', { createdAt: 1 }), bot('capo1', { primary: true, sessionId: 's-capo' })],
    sessions: [], running: new Set(), activeId: 's-other', phase: 'idle', interrupted: {}, runStart: {},
    pendingQuestions: [], teamMessages: [], teamLoaded: true, connected: false,
    onTeamGet: vi.fn(), onOpenBot: vi.fn(), ...over,
  };
}

describe('useAgentNav', () => {
  it('lists the primary agent first and knows no agent is open on a plain chat', () => {
    const { result } = renderHook(() => useAgentNav(input(), '/', vi.fn(), vi.fn()));
    expect(result.current.views.map((v) => v.bot.id)).toEqual(['capo1', 'ana01']);
    expect(result.current.active).toBeNull();
  });

  it('opens an agent at the bare root, then binds its thread', () => {
    const t = input();
    const nav = vi.fn();
    const { result } = renderHook(() => useAgentNav(t, '/', nav, vi.fn()));
    act(() => result.current.open('capo1'));
    expect(nav).toHaveBeenCalledWith('/');
    expect(t.onOpenBot).toHaveBeenCalledWith('capo1', 's-capo', 'capo1');
  });

  it('treats the open bot thread as the active agent', () => {
    const { result } = renderHook(() => useAgentNav(input({ activeId: 'new-bot-ana01' }), '/', vi.fn(), vi.fn()));
    expect(result.current.active?.bot.id).toBe('ana01');
  });

  it('lands /equipe on the primary agent', () => {
    const t = input();
    renderHook(() => useAgentNav(t, '/equipe' as Route, vi.fn(), vi.fn()));
    expect(t.onOpenBot).toHaveBeenCalledWith('capo1', 's-capo', 'capo1');
  });

  it('opens the agent page for the open agent, only while one is open', () => {
    const navAgent = vi.fn();
    const { result, rerender } = renderHook(({ id }) => useAgentNav(input({ activeId: id }), '/', vi.fn(), navAgent), { initialProps: { id: 's-capo' } });
    act(() => result.current.toggleProfile());
    expect(navAgent).toHaveBeenCalledWith('capo1');
    navAgent.mockClear();
    rerender({ id: 's-other' });
    act(() => result.current.toggleProfile());
    expect(navAgent).not.toHaveBeenCalled();
  });

  it('routes new and edit to the agent page', () => {
    const navAgent = vi.fn();
    const { result } = renderHook(() => useAgentNav(input({ activeId: 's-capo' }), '/', vi.fn(), navAgent));
    act(() => result.current.openNew());
    expect(navAgent).toHaveBeenLastCalledWith('novo');
    act(() => result.current.openEdit());
    expect(navAgent).toHaveBeenLastCalledWith('capo1');
  });
});
