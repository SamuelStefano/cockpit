import { describe, it, expect } from 'vitest';
import {
  busySessionIds, tmuxPaneSessionIds, CV_FRESH_MS, cvTermId, idleCvSessionIds, isCvShellLive, isRegistrySessionLive,
  liveCvSessionIds, liveRegistrySessionIds, parseProcRecord, procStartMatches, procStartTicks,
} from './cv-liveness';

const NOW = 1_000_000_000;
const base = { tmuxAlive: true, procAlive: true, busy: false, jsonlMtime: undefined, now: NOW };

describe('isCvShellLive', () => {
  it('alive tmux + alive busy process is live', () => {
    expect(isCvShellLive({ ...base, busy: true })).toBe(true);
  });

  it('alive but idle with a stale transcript is not live', () => {
    expect(isCvShellLive({ ...base, jsonlMtime: NOW - CV_FRESH_MS - 1 })).toBe(false);
  });

  it('a transcript written under 2 minutes ago is live even when idle', () => {
    expect(isCvShellLive({ ...base, jsonlMtime: NOW - CV_FRESH_MS + 1000 })).toBe(true);
  });

  it('busy flag does not count once the tmux session is gone', () => {
    expect(isCvShellLive({ ...base, busy: true, tmuxAlive: false })).toBe(false);
  });

  it('busy flag does not count for a dead process (stale registry file)', () => {
    expect(isCvShellLive({ ...base, busy: true, procAlive: false })).toBe(false);
  });

  it('a fresh transcript still counts right after the shell died', () => {
    expect(isCvShellLive({ ...base, tmuxAlive: false, procAlive: false, jsonlMtime: NOW - 5000 })).toBe(true);
  });
});

describe('isRegistrySessionLive', () => {
  const base = { procAlive: true, busy: false, jsonlMtime: undefined, now: NOW };

  it('an alive, busy process is live — no tmux involved at all', () => {
    expect(isRegistrySessionLive({ ...base, busy: true })).toBe(true);
  });

  it('a busy status does not count for a dead process (stale registry file)', () => {
    expect(isRegistrySessionLive({ ...base, busy: true, procAlive: false })).toBe(false);
  });

  // BLOCKER fix: procAlive gates the fresh-mtime branch too — a dead pid's
  // registry file must never count as live just because its last transcript
  // write happens to be recent. Without this, the dispatch 'send' guard (if
  // it reused this display list) would reject a normal follow-up sent right
  // after a turn closed and its process exited.
  it('a fresh transcript does NOT count for a dead process', () => {
    expect(isRegistrySessionLive({ ...base, procAlive: false, jsonlMtime: NOW - 5000 })).toBe(false);
  });

  it('a fresh transcript DOES count for an alive-but-idle process', () => {
    expect(isRegistrySessionLive({ ...base, procAlive: true, busy: false, jsonlMtime: NOW - 5000 })).toBe(true);
  });

  it('a stale transcript and an idle process is not live', () => {
    expect(isRegistrySessionLive({ ...base, jsonlMtime: NOW - CV_FRESH_MS - 1 })).toBe(false);
  });
});

describe('busySessionIds — strict, for the send guard only', () => {
  const deps = { procAlive: (pid: number) => pid !== 99 };

  it('keeps only alive pids reporting status busy', () => {
    const ids = busySessionIds([
      { pid: 1, sessionId: 'busy-alive', status: 'busy' },
      { pid: 2, sessionId: 'idle-alive', status: 'idle' },
      { pid: 99, sessionId: 'busy-dead', status: 'busy' },
    ], deps);
    expect(ids).toEqual(['busy-alive']);
  });

  // The exact BLOCKER scenario: a turn just closed elsewhere, the JSONL is
  // still fresh, but nothing reports 'busy' anymore — a normal follow-up
  // must not be rejected. busySessionIds has no fresh-mtime branch at all,
  // so a record like this never reaches it as "live" in the first place.
  it('has no fresh-mtime fallback — an idle-but-recently-active session is never in this set', () => {
    const ids = busySessionIds([{ pid: 1, sessionId: 'just-finished', status: 'idle' }], deps);
    expect(ids).toEqual([]);
  });
});

describe('liveRegistrySessionIds', () => {
  const deps = { procAlive: (pid: number) => pid !== 99, mtimeOf: () => undefined, now: NOW };

  it('keeps a busy, headless (no tmux) record — the cross-process Deck-turn case', () => {
    const ids = liveRegistrySessionIds([
      { pid: 1, sessionId: 'deck-turn', status: 'busy' },
      { pid: 2, sessionId: 'idle', status: 'idle' },
      { pid: 99, sessionId: 'dead-but-busy-file', status: 'busy' },
    ], deps);
    expect(ids).toEqual(['deck-turn']);
  });

  it('dedupes a session registered by two processes', () => {
    const ids = liveRegistrySessionIds([
      { pid: 1, sessionId: 's', status: 'busy' },
      { pid: 2, sessionId: 's', status: 'busy' },
    ], deps);
    expect(ids).toEqual(['s']);
  });
});

describe('cvTermId', () => {
  it('extracts the term id from a tmux target', () => {
    expect(cvTermId('cockpit-cv-linkedin:@114.%114')).toBe('cv-linkedin');
  });

  it('ignores non-cv tmux sessions and missing targets', () => {
    expect(cvTermId('cockpit-abc:@1.%1')).toBeUndefined();
    expect(cvTermId('work:@1.%1')).toBeUndefined();
    expect(cvTermId(undefined)).toBeUndefined();
  });
});

describe('parseProcRecord', () => {
  it('reads pid, sessionId, tmux and status', () => {
    const r = parseProcRecord(JSON.stringify({ pid: 7, sessionId: 's1', tmux: 'cockpit-cv-a:@1.%1', status: 'busy', extra: 1 }));
    expect(r).toEqual({ pid: 7, sessionId: 's1', tmux: 'cockpit-cv-a:@1.%1', status: 'busy' });
  });

  it('rejects malformed input', () => {
    expect(parseProcRecord('not json')).toBeUndefined();
    expect(parseProcRecord(JSON.stringify({ pid: '7', sessionId: 's1' }))).toBeUndefined();
    expect(parseProcRecord('null')).toBeUndefined();
    expect(parseProcRecord(JSON.stringify({ pid: -1, sessionId: 's1' }))).toBeUndefined();
  });
});

describe('liveCvSessionIds', () => {
  const deps = {
    liveTerms: new Set(['cv-a', 'cv-b']),
    procAlive: () => true,
    mtimeOf: (id: string) => (id === 'fresh' ? NOW - 1000 : NOW - 10 * 60_000),
    now: NOW,
  };

  it('keeps busy cv shells and fresh transcripts, drops idle and non-cv ones', () => {
    const ids = liveCvSessionIds([
      { pid: 1, sessionId: 'busy', tmux: 'cockpit-cv-a:@1.%1', status: 'busy' },
      { pid: 2, sessionId: 'idle', tmux: 'cockpit-cv-b:@2.%2', status: 'idle' },
      { pid: 3, sessionId: 'fresh', tmux: 'cockpit-cv-gone:@3.%3', status: 'idle' },
      { pid: 4, sessionId: 'plain', tmux: 'cockpit-x:@4.%4', status: 'busy' },
      { pid: 5, sessionId: 'notmux', status: 'busy' },
    ], deps);
    expect(ids).toEqual(['busy', 'fresh']);
  });

  it('dedupes a session registered by two processes', () => {
    const ids = liveCvSessionIds([
      { pid: 1, sessionId: 's', tmux: 'cockpit-cv-a:@1.%1', status: 'busy' },
      { pid: 2, sessionId: 's', tmux: 'cockpit-cv-b:@2.%2', status: 'busy' },
    ], deps);
    expect(ids).toEqual(['s']);
  });
});

describe('idleCvSessionIds', () => {
  const deps = {
    liveTerms: new Set(['cv-a', 'cv-b']),
    procAlive: (pid: number) => pid !== 4,
    mtimeOf: (id: string) => (id === 'fresh' ? NOW - 1000 : NOW - 10 * 60_000),
    now: NOW,
  };

  // The UX bug this closes: an interactive claude idle at its prompt (tmux +
  // proc alive, not busy, transcript stale) drops out of isCvShellLive's
  // live set entirely — without this separate signal the kanban reads it as
  // Done when it's actually waiting on Samuel.
  it('flags an alive-but-idle cv shell with a stale transcript', () => {
    const ids = idleCvSessionIds([
      { pid: 1, sessionId: 'idle-alive', tmux: 'cockpit-cv-a:@1.%1', status: 'idle' },
    ], deps);
    expect(ids).toEqual(['idle-alive']);
  });

  it('does not flag a busy cv shell (already live)', () => {
    const ids = idleCvSessionIds([
      { pid: 1, sessionId: 'busy-alive', tmux: 'cockpit-cv-a:@1.%1', status: 'busy' },
    ], deps);
    expect(ids).toEqual([]);
  });

  it('does not flag one with a fresh transcript (already live)', () => {
    const ids = idleCvSessionIds([
      { pid: 1, sessionId: 'fresh', tmux: 'cockpit-cv-a:@1.%1', status: 'idle' },
    ], deps);
    expect(ids).toEqual([]);
  });

  it('does not flag a dead process or a dead tmux shell', () => {
    const ids = idleCvSessionIds([
      { pid: 4, sessionId: 'dead-proc', tmux: 'cockpit-cv-a:@1.%1', status: 'idle' },
      { pid: 5, sessionId: 'dead-tmux', tmux: 'cockpit-cv-gone:@2.%2', status: 'idle' },
    ], deps);
    expect(ids).toEqual([]);
  });

  it('ignores a non-cv (or no tmux) record entirely', () => {
    const ids = idleCvSessionIds([{ pid: 1, sessionId: 'notmux', status: 'idle' }], deps);
    expect(ids).toEqual([]);
  });
});

describe('procStartTicks / procStartMatches', () => {
  const stat = (start: string) => `123 (my (odd) cmd) S ${'1 '.repeat(18)}${start} 0 0`;

  it('reads starttime past a comm with spaces and parens', () => {
    expect(procStartTicks(stat('649290542'))).toBe('649290542');
  });

  it('matches the recorded start, rejects a reused pid', () => {
    expect(procStartMatches('649290542', stat('649290542'))).toBe(true);
    expect(procStartMatches('649290542', stat('700000000'))).toBe(false);
  });

  it('trusts records without procStart or without /proc', () => {
    expect(procStartMatches(undefined, stat('1'))).toBe(true);
    expect(procStartMatches('5', undefined)).toBe(true);
  });

  it('parseProcRecord keeps procStart as a string', () => {
    expect(parseProcRecord(JSON.stringify({ pid: 7, sessionId: 's1', procStart: '42' }))?.procStart).toBe('42');
  });
});

describe('tmuxPaneSessionIds — idle interactive panes count', () => {
  it('keeps alive pids with a tmux target, busy or idle', () => {
    const ids = tmuxPaneSessionIds([
      { pid: 1, sessionId: 'idle-pane', status: 'idle', tmux: 'cockpit-cv-x:@1.%1' },
      { pid: 2, sessionId: 'busy-pane', status: 'busy', tmux: 'cockpit-cv-y:@2.%2' },
      { pid: 3, sessionId: 'headless', status: 'idle' },
      { pid: 99, sessionId: 'dead-pane', tmux: 'cockpit-cv-z:@3.%3' },
    ], { procAlive: (pid) => pid !== 99 });
    expect(ids).toEqual(['busy-pane', 'idle-pane']);
  });
});
