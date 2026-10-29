import { describe, expect, it } from 'vitest';
import { parseAuthStatus } from './claude-account';

describe('parseAuthStatus', () => {
  it('keeps only the safe fields', () => {
    const out = parseAuthStatus(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', email: 'a@b.co', orgName: 'Acme', accessToken: 'secret' }));
    expect(out).toEqual({ loggedIn: true, authMethod: 'claude.ai', email: 'a@b.co', orgName: 'Acme' });
  });
  it('handles logged out', () => {
    expect(parseAuthStatus('{"loggedIn":false}')).toEqual({ loggedIn: false });
  });
  it('rejects garbage', () => {
    expect(parseAuthStatus('nope')).toBeNull();
    expect(parseAuthStatus('{"email":"x"}')).toBeNull();
    expect(parseAuthStatus('null')).toBeNull();
  });
});
