import { describe, it, expect } from 'vitest';
import { copyHintCommand, looksSecret, sanitizeMcp } from './claude-import';

describe('sanitizeMcp', () => {
  it('blanks secret env values and reports them', () => {
    const r = sanitizeMcp({ command: 'npx', args: ['-y', 'pkg'], env: { API_KEY: 'abc', REGION: 'us-east-1' } })!;
    expect(r.server.env).toEqual({ API_KEY: '', REGION: 'us-east-1' });
    expect(r.needsFill).toEqual(['API_KEY']);
  });
  it('strips header tokens and url query secrets', () => {
    const r = sanitizeMcp({ type: 'http', url: 'https://x.dev/mcp?token=zzz&v=1', headers: { Authorization: 'Bearer abc' } })!;
    expect(r.server.headers).toEqual({ Authorization: '' });
    expect(r.server.url).toBe('https://x.dev/mcp?v=1');
    expect([...r.needsFill].sort()).toEqual(['header:Authorization', 'url:token']);
  });
  it('strips secret-looking args', () => {
    const r = sanitizeMcp({ command: 'x', args: ['--api-key=sk-abc', '--token', 'v', 'ok'] })!;
    expect(r.server.args).toEqual(['--api-key=', '--token', '', 'ok']);
  });
  it('keeps env references and rejects non-servers', () => {
    expect(sanitizeMcp({ command: 'x', env: { API_KEY: '${API_KEY}' } })!.needsFill).toEqual([]);
    expect(sanitizeMcp('nope')).toBeNull();
    expect(sanitizeMcp({ foo: 1 })).toBeNull();
  });
  it('detects well known token shapes', () => {
    expect(looksSecret('X', 'ghp_abcdef')).toBe(true);
    expect(looksSecret('REGION', 'us-east-1')).toBe(false);
  });
});

describe('copyHintCommand', () => {
  it('stages the three sibling paths into a user-owned dir', () => {
    const c = copyHintCommand('/home/tainan/.claude/');
    expect(c).toContain("'/home/tainan'/$f");
    expect(c).toContain('sudo chown -R');
  });
});
