import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A turn that already answered but keeps its process alive for a background task
// (dev server, poll loop) held its parked queue for hours. The drainer now writes
// the item onto that live stdin, and still waits on a turn that is generating.
const dir = mkdtempSync(join(tmpdir(), 'deck-bg-wait-drain-'));
process.env.COCKPIT_PARKED = join(dir, 'parked.json');
process.env.COCKPIT_QUEUE_PAUSE = join(dir, 'queue-paused.json');
process.env.COCKPIT_AWAITING = join(dir, 'awaiting.json');

const S = '0c1d0b8e-5a3f-4c2a-9f0e-2b7d4e6a8c91';
vi.mock('../canvas/cv-liveness', () => ({ readBusyElsewhereSessionIds: vi.fn(async () => []) }));
vi.mock('../canvas/orchestrator', () => ({ readOrchestratorSync: () => undefined, isTmuxAliveSync: () => true, paneLostClaudeSync: () => false, tmuxStateSync: () => 'alive' }));
vi.mock('../terminals', () => ({ hasTerm: vi.fn(() => false), openTerm: vi.fn(() => false), inputTerm: vi.fn() }));
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

import { drainParked, startParkedDrainer } from './runs';
import { threads, type Thread } from './threads';
import { addParked, clearParked, parkedView } from './parked';
import { run } from '../engine/claude';
import { broadcast } from './broadcast';

function liveThread(extra: Partial<Thread>, send = vi.fn(() => true)) {
  threads.set(S, { handle: { kill: vi.fn(), send }, sessionId: S, prompt: 'old', ...extra } as unknown as Thread);
  return send;
}

describe('queue drainer and a turn waiting on a background task', () => {
  beforeEach(() => {
    startParkedDrainer(3_600_000);
    threads.clear();
    clearParked(S, 'admin');
    vi.mocked(run).mockClear();
    vi.mocked(broadcast).mockClear();
  });

  it('writes the queued prompt onto the live stdin once the turn has answered', () => {
    const send = liveThread({ bgWaitSince: Date.now(), pendingBgTasks: [{ task_id: 't1', description: 'vite' }] });
    addParked(S, { prompt: 'next', role: 'admin', resumeId: S });
    drainParked();
    expect(send).toHaveBeenCalledWith('next');
    expect(run).not.toHaveBeenCalled();
    expect(parkedView()).toEqual([]);
    const th = threads.get(S)!;
    expect(th.bgWaitSince).toBeUndefined();
    expect(th.prompt).toBe('next');
    expect(broadcast).toHaveBeenCalledWith(expect.objectContaining({ t: 'user', sessionKey: S, text: 'next' }));
  });

  it('keeps the item queued while the turn is still generating', () => {
    const send = liveThread({ pendingBgTasks: [{ task_id: 't1' }] });
    addParked(S, { prompt: 'next', role: 'admin', resumeId: S });
    drainParked();
    expect(send).not.toHaveBeenCalled();
    expect(parkedView().map((p) => p.text)).toEqual(['next']);
  });

  it('puts the item back without counting an attempt when stdin already closed', () => {
    liveThread({ bgWaitSince: Date.now(), pendingBgTasks: [{ task_id: 't1' }] }, vi.fn(() => false));
    addParked(S, { prompt: 'next', role: 'admin', resumeId: S });
    drainParked();
    const view = parkedView();
    expect(view.map((p) => p.text)).toEqual(['next']);
    expect(run).not.toHaveBeenCalled();
  });
});
