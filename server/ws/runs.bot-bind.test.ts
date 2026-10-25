import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'deck-bot-bind-'));
process.env.COCKPIT_PARKED = join(dir, 'parked.json');
process.env.COCKPIT_QUEUE_PAUSE = join(dir, 'queue-paused.json');
process.env.COCKPIT_AWAITING = join(dir, 'awaiting.json');
process.env.COCKPIT_TEAM_PENDING = join(dir, 'team-pending.json');

const SID = '6ef8f243-a5aa-4082-bb40-29b66e7fa756';
const team = vi.hoisted(() => ({ bindBotSession: vi.fn(async (): Promise<unknown[] | null> => [{ id: 'capo1' }]) }));
vi.mock('../team', () => team);
vi.mock('../canvas/cv-liveness', () => ({ readBusyElsewhereSessionIds: vi.fn(async () => []) }));
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
vi.mock('../agents/acp-run', () => ({ runAgent: vi.fn(() => ({ kill: vi.fn(), send: vi.fn(() => false) })) }));

import { startRun } from './runs';
import { threads } from './threads';
import { run } from '../engine/claude';
import { broadcast } from './broadcast';
import { runAgent } from '../agents/acp-run';
import { readPendingQuestions, setPendingQuestion } from '../team-pending';

type Ev = (ev: unknown) => void;
const lastOnEvent = (): Ev => (vi.mocked(run).mock.calls.at(-1)![0] as unknown as { onEvent: Ev }).onEvent;

describe('a bot turn binds its session', () => {
  beforeEach(() => { threads.clear(); vi.clearAllMocks(); });

  it('persists the first sessionId once and broadcasts the team', async () => {
    startRun({ ws: null, sessionKey: 'new-bot-capo1', prompt: 'oi', botId: 'capo1', appendSystemPrompt: 'Você é capo' });
    expect(vi.mocked(run).mock.calls[0][0]).toMatchObject({ appendSystemPrompt: 'Você é capo' });
    const onEvent = lastOnEvent();
    onEvent({ type: 'system', session_id: SID });
    onEvent({ type: 'assistant', session_id: SID });
    await Promise.resolve(); await Promise.resolve();
    expect(team.bindBotSession).toHaveBeenCalledTimes(1);
    expect(team.bindBotSession).toHaveBeenCalledWith('capo1', SID);
    expect(broadcast).toHaveBeenCalledWith({ t: 'team', bots: [{ id: 'capo1' }] });
  });

  it('a new turn of the bot (routine, peer message) retires its open question', () => {
    const questions = [{ question: 'Q?', header: '', multiSelect: false, options: [{ label: 'A' }] }];
    setPendingQuestion({ botId: 'capo1', sessionKey: 'bot-capo1', questions, at: 1 });
    setPendingQuestion({ botId: 'lead1', sessionKey: 'bot-lead1', questions, at: 1 });
    startRun({ ws: null, sessionKey: 'bot-capo1', prompt: 'rotina', botId: 'capo1' });
    expect(readPendingQuestions().map((p) => p.botId)).toEqual(['lead1']);
    expect(broadcast).toHaveBeenCalledWith({ t: 'team-pending', items: [expect.objectContaining({ botId: 'lead1' })] });
  });

  it('never binds a plain turn or a fork', () => {
    startRun({ ws: null, sessionKey: 'k1', prompt: 'oi' });
    lastOnEvent()({ type: 'system', session_id: SID });
    startRun({ ws: null, sessionKey: 'f1', prompt: 'oi', botId: 'capo1', resumeId: SID, forkId: '7ef8f243-a5aa-4082-bb40-29b66e7fa756' });
    lastOnEvent()({ type: 'system', session_id: SID });
    expect(team.bindBotSession).not.toHaveBeenCalled();
  });
});

describe('a restricted bot turn (fatia E)', () => {
  beforeEach(() => { threads.clear(); vi.clearAllMocks(); });

  it('refuses an ACP agent model before anything spawns', () => {
    const r = startRun({ ws: null, sessionKey: 'new-bot-capo1', prompt: 'oi', botId: 'capo1', profile: 'restricted', model: 'agent:grok' });
    expect(r).toBe('rejected');
    expect(runAgent).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(threads.size).toBe(0);
  });

  it('the thread never stores the MCPs, bypass or workflow grant of the frame', () => {
    startRun({ ws: null, sessionKey: 'new-bot-capo1', prompt: 'oi', botId: 'capo1', profile: 'restricted', mcps: ['supabase'], bypass: true, allowWorkflow: true });
    const o = vi.mocked(run).mock.calls[0][0];
    expect(o).toMatchObject({ profile: 'restricted', botId: 'capo1' });
    expect(o.mcps).toBeUndefined();
    expect(o.bypass).toBeUndefined();
    expect(o.allowWorkflow).toBeUndefined();
  });

  it('a full bot may still use an ACP agent', () => {
    startRun({ ws: null, sessionKey: 'new-bot-capo1', prompt: 'oi', botId: 'capo1', profile: 'full', model: 'agent:grok' });
    expect(runAgent).toHaveBeenCalledOnce();
  });
});
