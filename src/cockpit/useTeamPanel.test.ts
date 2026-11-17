// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RedactedTeamPanel } from '../../shared/team-panel';
import { useTeamPanel } from './useTeamPanel';

const panel: RedactedTeamPanel = { redacted: true, at: 1, needsYou: 0, needs: [], sectors: [] };
beforeEach(() => localStorage.clear());

describe('useTeamPanel', () => {
  it('asks nothing while closed, then asks with the recording flag', () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useTeamPanel(send));
    expect(send).not.toHaveBeenCalled();
    act(() => result.current.setOpen(true));
    expect(send).toHaveBeenLastCalledWith({ t: 'team-panel-get', recording: false });
    act(() => result.current.setRecording(true));
    expect(send).toHaveBeenLastCalledWith({ t: 'team-panel-get', recording: true });
  });

  it('never asks when not enabled', () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useTeamPanel(send, false));
    act(() => result.current.setOpen(true));
    expect(send).not.toHaveBeenCalled();
    expect(result.current.open).toBe(false);
  });

  it('stores the pushed panel and ignores other frames', () => {
    const { result } = renderHook(() => useTeamPanel(vi.fn(() => true)));
    let claimed = true;
    act(() => { claimed = result.current.onMsg({ t: 'team-paused', paused: false }); });
    expect(claimed).toBe(false);
    act(() => { result.current.onMsg({ t: 'team-panel', panel }); });
    expect(result.current.panel).toEqual(panel);
  });
});
