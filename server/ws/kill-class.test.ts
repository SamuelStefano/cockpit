import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifyDeath, externalResumeGate, noteExternalKill, lastExternalKillAt, resetExternalKills,
  EXTERNAL_QUIET_MS,
} from './kill-class';
import type { MemInfo } from './mem-guard';

const healthy: MemInfo = { availMb: 2000, swapFreeMb: 4000, swapTotalMb: 4000 };
const starved: MemInfo = { availMb: 120, swapFreeMb: 10, swapTotalMb: 4000 };

describe('classifyDeath', () => {
  it('reports the user stop before anything else', () => {
    expect(classifyDeath({ exitCode: 143, userStopped: true, info: starved })).toBe('user-stop');
  });

  it('reports our own reaper kill as reaped, not an external signal', () => {
    expect(classifyDeath({ exitCode: 143, reaped: true, info: healthy })).toBe('reaped');
  });

  it('keeps OOM ahead of the external-signal bucket', () => {
    expect(classifyDeath({ exitCode: 137, info: starved })).toBe('oom');
  });

  it('classifies 143 on a healthy box as an external signal', () => {
    expect(classifyDeath({ exitCode: 143, info: healthy })).toBe('external-signal');
  });

  it('classifies a raw SIGTERM as an external signal even without an exit code', () => {
    expect(classifyDeath({ exitCode: null, signal: 'SIGTERM', info: healthy })).toBe('external-signal');
  });

  it('classifies any other exit as a plain crash', () => {
    expect(classifyDeath({ exitCode: 1, info: healthy })).toBe('crash');
    expect(classifyDeath({ exitCode: undefined, signal: null, info: healthy })).toBe('crash');
  });
});

describe('externalResumeGate', () => {
  const now = 1_000_000;

  it('waits while the kill wave is still fresh', () => {
    expect(externalResumeGate({ lastKillAt: now, now, waitedMs: 0 })).toBe('wait');
  });

  it('goes once the box has been quiet for the whole window', () => {
    expect(externalResumeGate({ lastKillAt: now - EXTERNAL_QUIET_MS, now, waitedMs: 30_000 })).toBe('go');
  });

  it('a sibling dying mid-wait pushes the window forward instead of resuming', () => {
    const lastKillAt = now - 1_000; // sibling died 1s ago, long after ours
    expect(externalResumeGate({ lastKillAt, now, waitedMs: EXTERNAL_QUIET_MS })).toBe('wait');
  });

  it('gives up when kills keep arriving past the budget', () => {
    expect(externalResumeGate({ lastKillAt: now, now, waitedMs: 10 * 60_000 })).toBe('give-up');
  });

  it('never gives up while the box is actually quiet', () => {
    expect(externalResumeGate({ lastKillAt: 0, now, waitedMs: 60 * 60_000 })).toBe('go');
  });
});

describe('noteExternalKill', () => {
  beforeEach(resetExternalKills);

  it('keeps the most recent kill of the wave', () => {
    noteExternalKill(500);
    noteExternalKill(900);
    noteExternalKill(700);
    expect(lastExternalKillAt()).toBe(900);
  });
});
