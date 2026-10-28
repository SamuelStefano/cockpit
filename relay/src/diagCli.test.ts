import { describe, it, expect } from 'vitest';
import { formatReports, parseDiagArgs } from './diagCli';

describe('diag-reports CLI', () => {
  it('parses limit, email, json and full', () => {
    expect(parseDiagArgs(['-n', '5', '--email', ' Tainan@X.com ', '--full'])).toEqual({ limit: 5, email: 'tainan@x.com', json: false, full: true });
    expect(parseDiagArgs(['--limit=9999', '--json'])).toMatchObject({ limit: 500, json: true });
    expect(parseDiagArgs([])).toEqual({ limit: 20, json: false, full: false });
  });

  it('prints the email when known and the payload with --full', () => {
    const rows = [{ id: '1', created_at: '2026-10-28T12:00:00Z', account_id: 'a1', source: 'browser', kind: 'box-offline', box_id: '3f2a9c1e-0000-0000-0000-000000000000', app_version: null, user_agent: null, payload: { cause: 'box-offline' } }];
    expect(formatReports(rows, new Map([['a1', 't@x.com']]), false)).toBe('2026-10-28 12:00:00  t@x.com  browser  box-offline  box 3f2a9c1e  -');
    expect(formatReports(rows, new Map(), true)).toContain('"cause": "box-offline"');
    expect(formatReports([], new Map(), false)).toBe('no reports');
  });
});
