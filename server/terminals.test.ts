import { describe, it, expect } from 'vitest';
import { parseTermSessions, clampDim, stripReports, trimBuffer, tmuxArgs, idleWatchers, resumeTerm, detachedToEvict } from './terminals';

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

describe('clampDim', () => {
  it('falls back to default for non-positive or non-finite input', () => {
    expect(clampDim(NaN, 24)).toBe(24);
    expect(clampDim(0, 80)).toBe(80);
    expect(clampDim(-5, 24)).toBe(24);
    expect(clampDim(Number('x' as unknown as number), 24)).toBe(24);
  });

  it('floors fractional values and keeps them in range', () => {
    expect(clampDim(80.9, 24)).toBe(80);
    expect(clampDim(1, 24)).toBe(1);
  });

  it('clamps above 500 down to 500', () => {
    expect(clampDim(9999, 24)).toBe(500);
  });
});

describe('stripReports', () => {
  it('strips terminal report responses (DA1/DA2/CPR/DECRPM)', () => {
    expect(stripReports('a\x1b[?62;1cb')).toBe('ab'); // DA1
    expect(stripReports('a\x1b[>0;276;0cb')).toBe('ab'); // DA2
    expect(stripReports('a\x1b[24;80Rb')).toBe('ab'); // CPR
    expect(stripReports('a\x1b[?2026;1$yb')).toBe('ab'); // DECRPM
  });

  it('strips OSC color-query replies (fg/bg/cursor/palette), ST- and BEL-terminated', () => {
    expect(stripReports('a\x1b]10;rgb:e5e5/e5e5/e5e5\x1b\\b')).toBe('ab'); // OSC 10 fg (ST)
    expect(stripReports('a\x1b]11;rgb:0a0a/0a0a/0a0a\x1b\\b')).toBe('ab'); // OSC 11 bg (ST)
    expect(stripReports('a\x1b]12;rgb:ffff/ffff/ffff\x07b')).toBe('ab'); // OSC 12 cursor (BEL)
    expect(stripReports('a\x1b]4;1;rgb:0000/0000/0000\x07b')).toBe('ab'); // OSC 4 palette (BEL)
    expect(stripReports('\x1b]10;rgb:1/1/1\x1b\\\x1b]11;rgb:2/2/2\x1b\\')).toBe(''); // back-to-back
  });

  it('leaves arrows, paste markers, plain text and OSC clipboard/title untouched', () => {
    expect(stripReports('\x1b[A\x1b[B\x1b[C\x1b[D')).toBe('\x1b[A\x1b[B\x1b[C\x1b[D');
    expect(stripReports('\x1b[200~hi\x1b[201~')).toBe('\x1b[200~hi\x1b[201~');
    expect(stripReports('ls -la\n')).toBe('ls -la\n');
    expect(stripReports('\x1b]52;c;aGVsbG8=\x07')).toBe('\x1b]52;c;aGVsbG8=\x07'); // OSC 52 clipboard
    expect(stripReports('\x1b]0;my title\x07')).toBe('\x1b]0;my title\x07'); // OSC 0 window title
  });
});

describe('trimBuffer', () => {
  it('returns the buffer unchanged when within the limit', () => {
    expect(trimBuffer('short', 100)).toBe('short');
  });

  it('trims to the window then to the first newline boundary', () => {
    expect(trimBuffer('aaaa\nbbbb', 6)).toBe('bbbb');
  });

  it('falls back to the raw window when there is no newline', () => {
    expect(trimBuffer('abcdef', 3)).toBe('def');
  });
});

describe('tmuxArgs', () => {
  const uuid = '55b717e4-4e61-4a4f-83f9-2d2a4cdea948';

  it('opens a plain shell session without a command', () => {
    const args = tmuxArgs('main')!;
    expect(args.slice(0, 4)).toEqual(['new-session', '-A', '-s', 'cockpit-main']);
    expect(args).toHaveLength(6);
  });

  it('follows the session transcript, then falls back to a login shell', () => {
    const cmd = tmuxArgs('w-abc', uuid)!.at(-1)!;
    expect(cmd).toContain('session-tail.py');
    expect(cmd).toContain(`${uuid}.jsonl`);
    expect(cmd).toMatch(/; exec bash -l'$/);
  });

  it('refuses a watch target that is not a session uuid', () => {
    expect(tmuxArgs('w-abc', "x'; rm -rf ~; '")).toBeNull();
    expect(tmuxArgs('w-abc', '../../etc/passwd')).toBeNull();
    expect(tmuxArgs('w-abc', '')).toBeNull();
  });
});

describe('idleWatchers', () => {
  const now = 1_000_000_000;
  it('picks watch panes unwatched past the idle window', () => {
    const out = idleWatchers([
      { id: 'w-old', idleSince: now - 20 * 60_000 },
      { id: 'w-fresh', idleSince: now - 60_000 },
      { id: 'w-watched', idleSince: null },
      { id: 'main', idleSince: now - 99 * 60_000 },
      { id: 'w-orphan', idleSince: 0 },
    ], now);
    expect(out).toEqual(['w-old', 'w-orphan']);
  });
});

describe('resumeTerm', () => {
  const uuid = '55b717e4-4e61-4a4f-83f9-2d2a4cdea948';
  it('refuses anything that is not an open watch pane of that session', async () => {
    expect(await resumeTerm('bad id', uuid)).toBe(false);
    expect(await resumeTerm('w-abc', 'x; rm -rf ~')).toBe(false);
    expect(await resumeTerm('w-never-opened', uuid)).toBe(false);
  });
});

describe('detachedToEvict', () => {
  const e = (id: string, idleSince: number | null, attached = false) => ({ id, attached, idleSince });

  it('closes the oldest idle detached clients beyond the cap', () => {
    const entries = [e('a', 1), e('b', 2), e('c', 3), e('d', 4)];
    expect(detachedToEvict(entries, 2)).toEqual(['a', 'b']);
  });

  it('never touches attached terminals or watch panes (those have their own reaper)', () => {
    const entries = [e('a', 1, true), e('w-x', 2), e('b', 3), e('c', 4)];
    expect(detachedToEvict(entries, 1)).toEqual(['b']);
  });
});
