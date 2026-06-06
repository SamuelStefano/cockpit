import { describe, it, expect } from 'vitest';
import { parseTermSessions } from './terminals';

describe('parseTermSessions', () => {
  it('keeps only cockpit-prefixed sessions and strips the prefix', () => {
    const out = parseTermSessions('0\ncockpit-main\ncockpit-term-101\nother\n');
    expect(out).toEqual(['main', 'term-101']);
  });

  it("excludes the user's own non-prefixed sessions", () => {
    expect(parseTermSessions('0\nwork\nmisc')).toEqual([]);
  });

  it('drops blank lines and trims', () => {
    expect(parseTermSessions('  cockpit-a  \n\n cockpit-b \n')).toEqual(['a', 'b']);
  });

  it('rejects ids that would not pass the tmux name allow-list', () => {
    expect(parseTermSessions('cockpit-bad id\ncockpit-ok')).toEqual(['ok']);
    expect(parseTermSessions(`cockpit-${'x'.repeat(40)}`)).toEqual([]);
  });

  it('returns [] when tmux produced nothing', () => {
    expect(parseTermSessions('')).toEqual([]);
  });
});
