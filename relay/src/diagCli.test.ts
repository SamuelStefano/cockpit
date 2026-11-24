import { describe, it, expect } from 'vitest';
import { formatReports, parseDiagArgs, termSafe } from './diagCli';

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

  it('never prints control bytes from a row', () => {
    expect(termSafe('a\u001b]52;c;evil\u0007b')).toBe('a?]52;c;evil?b');
    const rows = [{ id: '1', created_at: '2026-10-28T12:00:00Z', account_id: 'a1', source: 'browser', kind: 'x', box_id: null, app_version: '\u001b[2J', user_agent: null, payload: { m: '\u001b[31m' } }];
    expect(formatReports(rows, new Map(), true)).not.toMatch(/\u001b/);
  });
});
