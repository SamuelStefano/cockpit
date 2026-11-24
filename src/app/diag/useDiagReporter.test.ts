// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const insert = vi.fn(async (_row: unknown) => ({ error: null }));
vi.mock('../../lib/supabase', () => ({
  SUPABASE_ENABLED: true,
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) }, from: () => ({ insert }) },
}));

import { useDiagReporter } from './useDiagReporter';
import { boxStore } from '../../cockpit/boxes-store';
import { noteRelayFrame, recordConnEvent, resetTelemetryForTests } from '../connectionTelemetry';
import { PERSIST_MS, REPEAT_MS } from './incidentScheduler';

const BOX = { id: '3f2a9c1e-0000-4000-8000-000000000001', label: 'tainan-box', online: false, lastSeen: '2026-10-27T13:05:00.000Z' };

beforeEach(() => { vi.useFakeTimers(); insert.mockClear(); resetTelemetryForTests(); localStorage.clear(); boxStore.reset(); });
afterEach(() => { vi.useRealTimers(); });

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }); };

describe('useDiagReporter — box offline since yesterday (Tainan)', () => {
  it('names the cause and files a report after 20 s, then every 5 min', async () => {
    recordConnEvent('dial');
    noteRelayFrame('agent-offline');
    act(() => { boxStore.applyFrame({ t: 'boxes', box: null, primary: null, boxes: [BOX] }); });
    const { result } = renderHook(() => useDiagReporter({ conn: 'reconnecting', authRejected: false, agentOnline: false, showOffline: true, offlineSince: Date.now() }));
    expect(result.current.cause).toBe('box-offline');
    expect(result.current.box?.label).toBe('tainan-box');
    await flush();
    expect(insert).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(PERSIST_MS); });
    await flush();
    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0][0] as { kind: string; box_id: string; payload: { box: { label: string }; events: Array<{ ev: string }> } };
    expect(row.kind).toBe('box-offline');
    expect(row.box_id).toBe(BOX.id);
    expect(row.payload.box.label).toBe('tainan-box');
    expect(row.payload.events.map((e) => e.ev)).toContain('relay:agent-offline');
    await act(async () => { vi.advanceTimersByTime(REPEAT_MS); });
    await flush();
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it('files nothing while connected', async () => {
    const { result } = renderHook(() => useDiagReporter({ conn: 'connected', authRejected: false, agentOnline: true, showOffline: false, offlineSince: null }));
    expect(result.current.cause).toBeNull();
    await act(async () => { vi.advanceTimersByTime(10 * 60_000); });
    expect(insert).not.toHaveBeenCalled();
  });

  it('a relay that never answered reads as relay unreachable', () => {
    recordConnEvent('dial');
    const { result } = renderHook(() => useDiagReporter({ conn: 'down', authRejected: false, agentOnline: false, showOffline: true, offlineSince: Date.now() }));
    expect(result.current.cause).toBe('relay-unreachable');
  });
});
