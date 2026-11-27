// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { buildDiagRow, sendDiagReport, type DiagSnapshot } from './diagReport';
import { CONN_EVENTS_MAX, recordClose, recordConnEvent, resetTelemetryForTests } from '../connectionTelemetry';
import { DIAG_PAYLOAD_MAX, payloadBytes } from '../../../shared/diag';

afterEach(() => resetTelemetryForTests());

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
const BOX = { id: '3f2a9c1e-0000-4000-8000-000000000001', label: 'tainan-box', online: false, lastSeen: '2026-10-27T13:05:00Z' };
const snap: DiagSnapshot = { cause: 'box-offline', conn: 'reconnecting', seal: 'connecting', authRejected: false, agentOnline: false, offlineSince: 1_000, wsHost: 'relay.x', box: BOX, boxes: [BOX] };

describe('buildDiagRow', () => {
  it('carries cause, box, boxes, close and events, with secrets redacted', () => {
    recordConnEvent('dial');
    recordClose(4401, `auth ${JWT}`);
    const row = buildDiagRow('box-offline', snap, { note: `token=${JWT}` });
    expect(row).toMatchObject({ source: 'browser', kind: 'box-offline', box_id: BOX.id });
    const p = row.payload as Record<string, any>;
    expect(p.box.label).toBe('tainan-box');
    expect(p.boxes).toHaveLength(1);
    expect(p.lastClose.code).toBe(4401);
    expect(p.events.map((e: { ev: string }) => e.ev)).toEqual(['dial', 'close']);
    expect(JSON.stringify(row)).not.toContain(JWT);
  });

  it('keeps the payload under the column cap by trimming the oldest events', () => {
    for (let i = 0; i < CONN_EVENTS_MAX; i++) recordConnEvent('noise', { blob: 'x'.repeat(1000) });
    const row = buildDiagRow('relay-unreachable', snap);
    expect(payloadBytes(row.payload)).toBeLessThanOrEqual(DIAG_PAYLOAD_MAX);
    expect((row.payload as { eventsTrimmed?: boolean }).eventsTrimmed).toBe(true);
  });
});

describe('sendDiagReport', () => {
  it('inserts through the user session and never sends account_id', async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const client = { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) }, from: vi.fn(() => ({ insert })) };
    expect(await sendDiagReport('manual', {}, client as never)).toBe(true);
    expect(client.from).toHaveBeenCalledWith('diag_reports');
    const row = (insert.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(row).not.toHaveProperty('account_id');
    expect(row.source).toBe('browser');
  });

  it('does nothing without a session or a client', async () => {
    const client = { auth: { getSession: async () => ({ data: { session: null } }) }, from: vi.fn() };
    expect(await sendDiagReport('manual', {}, client as never)).toBe(false);
    expect(client.from).not.toHaveBeenCalled();
    expect(await sendDiagReport('manual', {}, null)).toBe(false);
  });
});
