import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';

// Isolated like dispatch-canvas.test.ts: 'orchestrator-get' only needs
// readOrchestrator mocked, not the whole canvas-get dependency graph.
const orchestratorMod = vi.hoisted(() => ({
  readOrchestrator: vi.fn(async () => undefined as { name: string; sessionId: string; tmux: string } | undefined),
}));
vi.mock('../canvas/orchestrator', () => orchestratorMod);

const activityMod = vi.hoisted(() => ({
  readOrchestratorActivity: vi.fn(async () => ({ subagents: [], delegatedShells: [], rawShells: [] })),
}));
vi.mock('../canvas/orchestrator-activity', () => activityMod);

const bc = vi.hoisted(() => ({ send: vi.fn(), broadcast: vi.fn() }));
vi.mock('./broadcast', () => bc);

import { handle } from './dispatch';

const ws = {} as WebSocket;

beforeEach(() => { vi.clearAllMocks(); });

describe("'orchestrator-get' — cheap identity read, no graph build", () => {
  it('answers with info when an Orchestrator is configured', async () => {
    const info = { name: 'Orchestrator', sessionId: 'sid-1', tmux: 'cockpit-cv-abc' };
    orchestratorMod.readOrchestrator.mockResolvedValueOnce(info);
    await handle(ws, { t: 'orchestrator-get' }, 'student');
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'orchestrator-info', info });
  });

  it('answers with info undefined when none is configured', async () => {
    orchestratorMod.readOrchestrator.mockResolvedValueOnce(undefined);
    await handle(ws, { t: 'orchestrator-get' }, 'student');
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'orchestrator-info', info: undefined });
  });
});

describe("'orchestrator-activity-get' — the dock's 'Em andamento' panel", () => {
  it('reads the activity for the configured Orchestrator', async () => {
    const info = { name: 'Orchestrator', sessionId: 'sid-1', tmux: 'cockpit-cv-abc' };
    const activity = { subagents: [], delegatedShells: [{ name: 'x', status: 'running' as const, tmuxAlive: false }], rawShells: [] };
    orchestratorMod.readOrchestrator.mockResolvedValueOnce(info);
    activityMod.readOrchestratorActivity.mockResolvedValueOnce(activity);
    await handle(ws, { t: 'orchestrator-activity-get' }, 'admin');
    expect(activityMod.readOrchestratorActivity).toHaveBeenCalledWith(info);
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'orchestrator-activity', activity });
  });

  it('answers an empty activity instead of erroring when no Orchestrator is configured', async () => {
    orchestratorMod.readOrchestrator.mockResolvedValueOnce(undefined);
    await handle(ws, { t: 'orchestrator-activity-get' }, 'admin');
    expect(activityMod.readOrchestratorActivity).not.toHaveBeenCalled();
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'orchestrator-activity', activity: { subagents: [], delegatedShells: [], rawShells: [] } });
  });
});
