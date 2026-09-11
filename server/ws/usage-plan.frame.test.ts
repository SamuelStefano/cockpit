import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let dir: string;
let cachePath: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(join(tmpdir(), 'deck-plan-usage-'));
  cachePath = join(dir, 'plan-usage.json');
  process.env.COCKPIT_PLAN_USAGE = cachePath;
});

afterEach(() => {
  delete process.env.COCKPIT_PLAN_USAGE;
  rmSync(dir, { recursive: true, force: true });
});

const usage = { fiveHour: 12, sevenDay: 63, resetsAt: null };

describe('planUsageFrame', () => {
  it('returns nothing when there is neither a number nor a block', async () => {
    const mod = await import('./usage-plan');
    expect(mod.planUsageFrame()).toBeNull();
  });

  it('still sends the 429 block when there is no number yet, so a browser is not left loading', async () => {
    const blockedUntil = Date.now() + 3_600_000;
    writeFileSync(cachePath, JSON.stringify({ ts: 0, usage: {}, cooldownUntil: blockedUntil, rateStreak: 1 }));
    const mod = await import('./usage-plan');

    const frame = mod.planUsageFrame();

    expect(frame).toMatchObject({ t: 'plan-usage', usage: null, readAt: null });
    expect(frame?.blockedUntil).toBe(blockedUntil);
  });

  it('carries the reading age and the block along with the number', async () => {
    const readAt = Date.now() - 60_000;
    const blockedUntil = Date.now() + 3_600_000;
    writeFileSync(cachePath, JSON.stringify({ ts: readAt, usage, cooldownUntil: blockedUntil, rateStreak: 1 }));
    const mod = await import('./usage-plan');
    mod.startPlanUsageLoop(() => false);

    const frame = mod.planUsageFrame();

    expect(frame?.usage).toMatchObject({ sevenDay: 63 });
    expect(frame?.readAt).toBe(readAt);
    expect(frame?.blockedUntil).toBe(blockedUntil);
  });
});
