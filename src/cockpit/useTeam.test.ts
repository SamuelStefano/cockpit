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
