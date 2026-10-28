import { describe, it, expect } from 'vitest';
import { AGENT_DIAG_LINES, DIAG_PAYLOAD_MAX, parseAgentDiag, payloadBytes, redactText, redactValue } from './diag';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

describe('redactText', () => {
  it('removes JWTs, bearer tokens and api keys', () => {
    expect(redactText(`auth ${JWT} done`)).toBe('auth [jwt] done');
    expect(redactText('Authorization: Bearer abcdefghijklmnop1234')).toBe('Authorization: Bearer [token]');
    expect(redactText('subprotocol bearer.abcdefghijklmnopqrstu')).toBe('subprotocol bearer.[token]');
    expect(redactText('key sk-ant-api03-AAAAAAAAAAAAAAAA')).toBe('key [secret]');
    expect(redactText('gh ghp_1234567890abcdefghij')).toBe('gh [secret]');
  });

  it('removes query-string and json secrets', () => {
    expect(redactText('wss://relay/ws?box=1&token=abc.def')).toBe('wss://relay/ws?box=1&token=[redacted]');
    expect(redactText('{"password":"hunter22"}')).toBe('{"password":"[redacted]"}');
  });

  it('removes enroll codes and pairing env', () => {
    expect(redactText('code ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567 typed')).toBe('code [enroll-code] typed');
    expect(redactText('DECK_PAIR_CODE=xyz123 bash')).toBe('DECK_PAIR_CODE=[redacted] bash');
  });

  it('keeps ordinary diagnostics intact', () => {
    const line = 'close 4401 auth · box 3f2a offline since 2026-10-27T10:00:00Z';
    expect(redactText(line)).toBe(line);
  });
});

describe('redactValue', () => {
  it('blanks secret keys and redacts nested strings, keeps numbers', () => {
    expect(redactValue({ token: 'x', ev: { code: 4401, reason: `jwt ${JWT}` }, list: [JWT] }))
      .toEqual({ token: '[redacted]', ev: { code: 4401, reason: 'jwt [jwt]' }, list: ['[jwt]'] });
  });
});

describe('parseAgentDiag', () => {
  it('accepts a well-formed frame and redacts its lines', () => {
    expect(parseAgentDiag({ t: 'diag-report', kind: 'crash', lines: [`boom ${JWT}`], version: 'abc1234' }))
      .toEqual({ kind: 'crash', payload: { lines: ['boom [jwt]'], version: 'abc1234' } });
  });

  it('rejects bad kinds, too many lines and non-string lines', () => {
    expect(parseAgentDiag({ t: 'diag-report', kind: 'Crash!', lines: [] })).toBeNull();
    expect(parseAgentDiag({ t: 'diag-report', kind: 'crash', lines: Array(AGENT_DIAG_LINES + 1).fill('x') })).toBeNull();
    expect(parseAgentDiag({ t: 'diag-report', kind: 'crash', lines: [1] })).toBeNull();
    expect(parseAgentDiag({ t: 'other', kind: 'crash', lines: [] })).toBeNull();
  });

  it('truncates long lines so the payload stays under the column cap', () => {
    const r = parseAgentDiag({ t: 'diag-report', kind: 'crash', lines: Array(AGENT_DIAG_LINES).fill('y'.repeat(10_000)) });
    expect(r).not.toBeNull();
    expect(payloadBytes(r!.payload)).toBeLessThanOrEqual(DIAG_PAYLOAD_MAX);
  });

  it('drops a version that is not a git sha', () => {
    expect(parseAgentDiag({ t: 'diag-report', kind: 'crash', lines: [], version: '<script>' })?.payload).toEqual({ lines: [] });
  });
});
