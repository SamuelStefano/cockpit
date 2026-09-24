import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A session running in the OTHER backend (or an interactive claude) must not get
// a queued prompt started on top of it by this process's drainer.
const dir = mkdtempSync(join(tmpdir(), 'deck-busy-elsewhere-'));
process.env.COCKPIT_PARKED = join(dir, 'parked.json');
process.env.COCKPIT_QUEUE_PAUSE = join(dir, 'queue-paused.json');
process.env.COCKPIT_AWAITING = join(dir, 'awaiting.json');

const S = '6ef8f243-a5aa-4082-bb40-29b66e7fa756';
const liveness = vi.hoisted(() => ({ readBusyElsewhereSessionIds: vi.fn(async () => [] as string[]) }));
vi.mock('../canvas/cv-liveness', () => liveness);
vi.mock('../canvas/orchestrator', () => ({ readOrchestratorSync: () => undefined, isTmuxAliveSync: () => false }));
vi.mock('../terminals', () => ({ hasTerm: vi.fn(), openTerm: vi.fn(), inputTerm: vi.fn() }));
vi.mock('../db', () => ({ lastUsageOf: () => null }));
vi.mock('../engine/claude', () => ({
  run: vi.fn(() => ({ kill: vi.fn(), send: vi.fn(() => false) })),
  resolveMcpSelection: vi.fn(() => undefined),
}));
vi.mock('./resume', () => ({ resumableId: vi.fn((id?: string) => id) }));
vi.mock('./broadcast', () => ({ broadcast: vi.fn(), send: vi.fn(), setWss: vi.fn() }));
vi.mock('./translate', () => ({ translate: vi.fn() }));
vi.mock('../summary', () => ({ summarize: vi.fn(async () => {}) }));
vi.mock('../engine/triage', () => ({ classify: vi.fn(), quickAnswer: vi.fn(), killSideRuns: vi.fn(), killSideRunsFor: vi.fn() }));
vi.mock('../engine/suggest', () => ({ suggestFollowups: vi.fn(async () => []) }));
vi.mock('./incidents', () => ({ recordIncident: vi.fn() }));
vi.mock('./recover', () => ({ markRunLive: vi.fn(), clearRunLive: vi.fn(), takeOrphanRuns: vi.fn(() => []) }));

import { drainParked, refreshBusyElsewhere, startParkedDrainer } from './runs';
import { threads } from './threads';
import { addParked, clearParked, parkedView } from './parked';
import { run } from '../engine/claude';

describe('queue drainer and the other backend', () => {
  beforeEach(() => {
    startParkedDrainer(3_600_000);
    threads.clear();
    clearParked(S, 'admin');
    vi.mocked(run).mockClear();
  });

  it('holds a queued prompt while the session runs in the other process', async () => {
    liveness.readBusyElsewhereSessionIds.mockResolvedValueOnce([S]);
    await refreshBusyElsewhere();
    addParked(S, { prompt: 'next', role: 'admin', resumeId: S });
    drainParked();
    expect(run).not.toHaveBeenCalled();
    expect(parkedView().map((p) => p.text)).toEqual(['next']);
  });

  it('fires it once the other process is done', async () => {
    liveness.readBusyElsewhereSessionIds.mockResolvedValueOnce([]);
    await refreshBusyElsewhere();
    addParked(S, { prompt: 'next', role: 'admin', resumeId: S });
    drainParked();
    expect(run).toHaveBeenCalledOnce();
  });
});
