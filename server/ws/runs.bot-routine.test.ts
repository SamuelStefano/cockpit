import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Cron, TeamBot } from '../../shared/protocol';

const dir = mkdtempSync(join(tmpdir(), 'deck-bot-routine-'));
process.env.COCKPIT_PARKED = join(dir, 'parked.json');
process.env.COCKPIT_QUEUE_PAUSE = join(dir, 'queue-paused.json');
process.env.COCKPIT_AWAITING = join(dir, 'awaiting.json');

const SID = '6ef8f243-a5aa-4082-bb40-29b66e7fa756';
const team = vi.hoisted(() => ({
  bindBotSession: vi.fn(async (): Promise<unknown[] | null> => null),
  getTeam: vi.fn(async (): Promise<TeamBot[]> => []),
}));
vi.mock('../team', () => team);
const liveness = vi.hoisted(() => ({ readBusyElsewhereSessionIds: vi.fn(async (): Promise<string[]> => []) }));
vi.mock('../canvas/cv-liveness', () => liveness);
vi.mock('../canvas/orchestrator', () => ({ readOrchestratorSync: () => undefined, isTmuxAliveSync: () => false, paneLostClaudeSync: () => false, tmuxStateSync: () => 'alive' }));
vi.mock('../terminals', () => ({ hasTerm: vi.fn(() => false), openTerm: vi.fn(), inputTerm: vi.fn() }));
vi.mock('../db', () => ({ lastUsageOf: () => null }));
vi.mock('../engine/claude', () => ({
  run: vi.fn(() => ({ kill: vi.fn(), send: vi.fn(() => false) })),
  resolveMcpSelection: vi.fn(() => undefined),
}));
vi.mock('./resume', () => ({ resumableId: vi.fn((id?: string) => id) }));
vi.mock('./broadcast', () => ({ broadcast: vi.fn(), send: vi.fn(), setWss: vi.fn() }));
vi.mock('./translate', () => ({
  translate: vi.fn((_k: string, thread: { sessionId?: string }, ev: { session_id?: string }) => { if (ev.session_id) thread.sessionId ??= ev.session_id; }),
}));
vi.mock('../summary', () => ({ summarize: vi.fn(async () => {}) }));
vi.mock('../engine/triage', () => ({ classify: vi.fn(), quickAnswer: vi.fn(), killSideRuns: vi.fn(), killSideRunsFor: vi.fn() }));
vi.mock('./incidents', () => ({ recordIncident: vi.fn() }));
vi.mock('./recover', () => ({ markRunLive: vi.fn(), clearRunLive: vi.fn(), takeOrphanRuns: vi.fn(() => []) }));

import { fireCron, startRun } from './runs';
import { threads } from './threads';
import { run } from '../engine/claude';

const capo: TeamBot = {
  id: 'capo1', name: 'capo', label: 'coo', instructions: 'coordene a equipe', mascot: { shape: 'drop', color: '#22c55e' },
  profile: 'full', primary: true, sessionId: SID, model: 'claude-sonnet-4-6', mode: 'acceptEdits', effort: 'medium', createdAt: 1, updatedAt: 1,
};
const routine: Cron = {
  id: 'r1', name: 'métricas', prompt: 'puxe as métricas', schedule: { kind: 'interval', everyMinutes: 5 },
  mode: 'plan', enabled: true, createdAt: 1, botId: 'capo1',
};
const runOpts = (i = 0) => vi.mocked(run).mock.calls[i][0] as unknown as Record<string, unknown>;

describe('fireCron for a bot routine', () => {
  beforeEach(() => {
    threads.clear(); vi.clearAllMocks();
    team.getTeam.mockResolvedValue([capo]);
    liveness.readBusyElsewhereSessionIds.mockResolvedValue([]);
  });

  it('runs in the bot thread with its session, identity and turn settings', async () => {
    expect(await fireCron(routine)).toBe('started');
    expect(threads.has('bot-capo1')).toBe(true);
    expect(threads.has('cron-r1')).toBe(false);
    expect(runOpts()).toMatchObject({
      prompt: 'puxe as métricas', resumeId: SID, model: 'claude-sonnet-4-6', mode: 'acceptEdits', effort: 'medium',
    });
    expect(String(runOpts().appendSystemPrompt)).toContain('Você é capo, coo');
    expect(threads.get('bot-capo1')!.params.botId).toBe('capo1');
  });

  it('skips the tick while the bot has a live turn, under any key', async () => {
    startRun({ ws: null, sessionKey: SID, prompt: 'conversa', resumeId: SID });
    const live = threads.get(SID);
    expect(await fireCron(routine)).toBe('bot-busy');
    expect(run).toHaveBeenCalledTimes(1);
    expect(threads.get(SID)).toBe(live);
    expect(live!.handle.kill).not.toHaveBeenCalled();
  });

  it('skips while the first turn still runs under the draft key', async () => {
    team.getTeam.mockResolvedValue([{ ...capo, sessionId: undefined }]);
    startRun({ ws: null, sessionKey: 'new-bot-capo1', prompt: 'oi', botId: 'capo1' });
    expect(await fireCron(routine)).toBe('bot-busy');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('skips while the bot session is busy in the other Deck process', async () => {
    liveness.readBusyElsewhereSessionIds.mockResolvedValue([SID]);
    expect(await fireCron(routine)).toBe('bot-busy');
    expect(run).not.toHaveBeenCalled();
  });

  it('never fires once the bot is gone', async () => {
    team.getTeam.mockResolvedValue([]);
    expect(await fireCron(routine)).toBe('bot-gone');
    expect(run).not.toHaveBeenCalled();
  });

  it('leaves a plain cron on its own cron-<id> session', async () => {
    expect(await fireCron({ ...routine, botId: undefined })).toBe('started');
    expect(threads.has('cron-r1')).toBe(true);
    expect(runOpts()).not.toHaveProperty('appendSystemPrompt');
    expect(team.getTeam).not.toHaveBeenCalled();
  });
});
