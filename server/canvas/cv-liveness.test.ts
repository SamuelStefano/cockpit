import { describe, it, expect } from 'vitest';
import {
  CV_FRESH_MS, cvTermId, isCvShellLive, isRegistrySessionLive, liveCvSessionIds, liveRegistrySessionIds, parseProcRecord,
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

  it('a transcript written under 2 minutes ago is live even when idle/dead', () => {
    expect(isRegistrySessionLive({ ...base, procAlive: false, jsonlMtime: NOW - 5000 })).toBe(true);
  });

  it('a stale transcript and an idle process is not live', () => {
    expect(isRegistrySessionLive({ ...base, jsonlMtime: NOW - CV_FRESH_MS - 1 })).toBe(false);
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
