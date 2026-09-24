import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A queued item for the Orchestrator's own session is delivered by pasting it
// into the live tmux pane, so no thread exists afterwards. The queue must treat
// that as delivered, not as a failed spawn to retry on every tick.
const dir = mkdtempSync(join(tmpdir(), 'deck-orch-queue-'));
process.env.COCKPIT_PARKED = join(dir, 'parked.json');
process.env.COCKPIT_QUEUE_PAUSE = join(dir, 'queue-paused.json');
process.env.COCKPIT_AWAITING = join(dir, 'awaiting.json');

const ORCH = 'orch-session';
vi.mock('../canvas/orchestrator', () => ({
  readOrchestratorSync: () => ({ name: 'Orchestrator', sessionId: 'orch-session', tmux: 'orch' }),
  isTmuxAliveSync: () => true,
  paneLostClaudeSync: () => false,
}));
const terms = vi.hoisted(() => ({ hasTerm: vi.fn(() => true), openTerm: vi.fn(), inputTerm: vi.fn() }));
vi.mock('../terminals', () => terms);
vi.mock('../db', () => ({ lastUsageOf: () => null }));
vi.mock('../engine/claude', () => ({
  run: vi.fn(() => ({ kill: vi.fn() })),
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

import { runParkedNow, startParkedDrainer, drainParked } from './runs';
import { threads } from './threads';
import { addParked, parkedView, clearParked } from './parked';
import { run } from '../engine/claude';

const queued = () => parkedView().map((p) => p.text);

describe('queue → Orchestrator pane', () => {
  beforeEach(() => {
    threads.clear();
    clearParked(ORCH, 'admin');
    terms.inputTerm.mockClear();
    vi.mocked(run).mockClear();
  });

  it('drainer pastes the item once and does not put it back', () => {
    startParkedDrainer(3_600_000);
    addParked(ORCH, { prompt: 'continue', role: 'admin' });
    drainParked();
    drainParked();
    drainParked();
    expect(terms.inputTerm).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
    expect(queued()).toEqual([]);
  });

  it('queue-force reports success instead of "falhou"', () => {
    const { id } = addParked(ORCH, { prompt: 'now', role: 'admin' }) as { id: string };
    expect(runParkedNow(ORCH, id, 'admin')).toEqual({ ok: true });
    expect(terms.inputTerm).toHaveBeenCalledTimes(1);
    expect(queued()).toEqual([]);
  });
});

process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
