import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseMemInfoText, readMemInfo, memoryVerdict, looksLikeOomKill, nextResumeDelayMs, memoryRunCap } from './mem-guard';

describe('parseMemInfoText', () => {
  it('parses MemAvailable/SwapTotal/SwapFree from /proc/meminfo text', () => {
    const text = 'MemTotal:        3980000 kB\nMemAvailable:    1200000 kB\nSwapTotal:       4194300 kB\nSwapFree:        3000000 kB\n';
    expect(parseMemInfoText(text)).toEqual({ availMb: 1172, swapTotalMb: 4096, swapFreeMb: 2930 });
  });

  it('defaults swap to zero when the lines are absent', () => {
    expect(parseMemInfoText('MemAvailable:    500000 kB\n')).toEqual({ availMb: 488, swapTotalMb: 0, swapFreeMb: 0 });
  });

  it('returns null when MemAvailable is missing (non-Linux /proc)', () => {
    expect(parseMemInfoText('garbage\n')).toBeNull();
  });
});

describe('readMemInfo', () => {
  // Best-effort smoke test only: the real /proc/meminfo on the test box varies,
  // so we just assert the shape, not concrete numbers (concrete numbers are
  // covered by parseMemInfoText above, which is the pure part).
  it('returns a well-formed MemInfo', () => {
    const info = readMemInfo();
    expect(info.availMb).toBeGreaterThanOrEqual(0);
    expect(info.swapFreeMb).toBeGreaterThanOrEqual(0);
    expect(info.swapTotalMb).toBeGreaterThanOrEqual(0);
  });
});

describe('memoryVerdict', () => {
  afterEach(() => { delete process.env.COCKPIT_MIN_AVAIL_MB; });

  it('is ok with plenty of memory and no swap', () => {
    expect(memoryVerdict({ availMb: 2000, swapFreeMb: 0, swapTotalMb: 0 })).toBe('ok');
  });

  it('is low when availMb is under the default 500MB floor', () => {
    expect(memoryVerdict({ availMb: 499, swapFreeMb: 0, swapTotalMb: 0 })).toBe('low');
  });

  it('respects a custom minAvailMb', () => {
    expect(memoryVerdict({ availMb: 800, swapFreeMb: 0, swapTotalMb: 0 }, { minAvailMb: 1000 })).toBe('low');
  });

  it('respects COCKPIT_MIN_AVAIL_MB env override', () => {
    process.env.COCKPIT_MIN_AVAIL_MB = '1500';
    expect(memoryVerdict({ availMb: 1000, swapFreeMb: 0, swapTotalMb: 0 })).toBe('low');
  });

  it('is low when swap is almost exhausted AND availMb is still tight', () => {
    expect(memoryVerdict({ availMb: 850, swapFreeMb: 50, swapTotalMb: 4096 })).toBe('low');
  });

  it('is ok when swap is almost exhausted but availMb is comfortable', () => {
    expect(memoryVerdict({ availMb: 2000, swapFreeMb: 50, swapTotalMb: 4096 })).toBe('ok');
  });

  it('ignores swap ratio when swapTotalMb is zero (no swap configured)', () => {
    expect(memoryVerdict({ availMb: 850, swapFreeMb: 0, swapTotalMb: 0 })).toBe('ok');
  });
});

describe('looksLikeOomKill', () => {
  const lowInfo = { availMb: 200, swapFreeMb: 100, swapTotalMb: 4096 };
  const okInfo = { availMb: 3000, swapFreeMb: 4000, swapTotalMb: 4096 };

  it('is true for exit 143 on a starved box', () => {
    expect(looksLikeOomKill({ exitCode: 143, info: lowInfo })).toBe(true);
  });

  it('is true for exit 137 on a starved box', () => {
    expect(looksLikeOomKill({ exitCode: 137, info: lowInfo })).toBe(true);
  });

  it('is true for a bare SIGTERM/SIGKILL signal on a starved box', () => {
    expect(looksLikeOomKill({ exitCode: null, signal: 'SIGTERM', info: lowInfo })).toBe(true);
    expect(looksLikeOomKill({ exitCode: null, signal: 'SIGKILL', info: lowInfo })).toBe(true);
  });

  it('is false for exit 143 on a healthy box (some other crash)', () => {
    expect(looksLikeOomKill({ exitCode: 143, info: okInfo })).toBe(false);
  });

  it('is false for an unrelated exit code even when the box is starved', () => {
    expect(looksLikeOomKill({ exitCode: 1, info: lowInfo })).toBe(false);
  });

  it('is false when the user stopped the turn', () => {
    expect(looksLikeOomKill({ exitCode: 143, userStopped: true, info: lowInfo })).toBe(false);
  });

  it('is false when the reaper stopped the turn', () => {
    expect(looksLikeOomKill({ exitCode: 143, reaped: true, info: lowInfo })).toBe(false);
  });

  it('is true when swap free is under 10% even if MemAvailable clears the floor', () => {
    expect(looksLikeOomKill({ exitCode: 137, info: { availMb: 1500, swapFreeMb: 50, swapTotalMb: 4096 } })).toBe(true);
  });
});

describe('nextResumeDelayMs — backoff progression', () => {
  it('starts at 30s, then 60s, then 120s', () => {
    expect(nextResumeDelayMs(1)).toBe(30_000);
    expect(nextResumeDelayMs(2)).toBe(60_000);
    expect(nextResumeDelayMs(3)).toBe(120_000);
  });

  it('caps subsequent steps at 5 minutes', () => {
    expect(nextResumeDelayMs(4)).toBe(300_000);
    expect(nextResumeDelayMs(5)).toBe(300_000);
  });

  it('gives up once the running total would exceed ~30 minutes', () => {
    let attempt = 1;
    let total = 0;
    let delay = nextResumeDelayMs(attempt);
    while (delay !== null) {
      total += delay;
      attempt += 1;
      delay = nextResumeDelayMs(attempt);
    }
    expect(total).toBeLessThanOrEqual(30 * 60_000);
    expect(attempt).toBeGreaterThan(3); // actually backed off more than once before giving up
  });

  it('treats attempt < 1 as attempt 1', () => {
    expect(nextResumeDelayMs(0)).toBe(30_000);
    expect(nextResumeDelayMs(-5)).toBe(30_000);
  });
});

describe('memoryRunCap', () => {
  it('matches the configured ceiling when memory is plentiful', () => {
    expect(memoryRunCap(5000, 12)).toBe(12);
  });

  it('shrinks proportionally as available memory drops', () => {
    // (1200 - 400) / 350 = 2.28 -> floor 2
    expect(memoryRunCap(1200, 12)).toBe(2);
  });

  it('never drops below 1 even on a very starved box', () => {
    expect(memoryRunCap(50, 12)).toBe(1);
    expect(memoryRunCap(0, 12)).toBe(1);
  });

  it('counts live runs as already paid for: only the extra ones need free memory', () => {
    // 3 alive, 1300MB left -> floor(900/350) = 2 more fit
    expect(memoryRunCap(1300, 12, 3)).toBe(5);
    // 3 alive, 600MB left -> no room for a 4th
    expect(memoryRunCap(600, 12, 3)).toBe(3);
  });

  it('never exceeds the configured base cap', () => {
    expect(memoryRunCap(100_000, 12)).toBe(12);
  });
});
