import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TeamBot } from '../../shared/protocol';

const runs = vi.hoisted(() => ({ startRun: vi.fn((_o: Record<string, unknown>): 'pane' | 'rejected' | undefined => undefined), isDrainerEnabled: vi.fn(() => false) }));
vi.mock('./runs', async () => {
  const { threads } = await import('./threads');
  const botLiveKey = (botId: string, sessionId?: string) => {
    for (const [k, t] of threads) if (t.params?.botId === botId || (sessionId && t.sessionId === sessionId)) return k;
    return undefined;
  };
  return { ...runs, botLiveKey };
});
const pending = vi.hoisted(() => ({ enqueuePending: vi.fn(() => true) }));
vi.mock('./pending', () => pending);
const parked = vi.hoisted(() => ({ addParked: vi.fn((): { id: string } | { reject: string } => ({ id: 'p1' })) }));
vi.mock('./parked', () => parked);
vi.mock('./resume', () => ({ resumableId: vi.fn((id?: string) => id) }));
const term = vi.hoisted(() => ({ hasInteractiveClaude: vi.fn(async () => false) }));
vi.mock('../canvas/term-stats', () => term);
const live = vi.hoisted(() => ({ readBusyElsewhereSessionIds: vi.fn(async (): Promise<string[]> => []) }));
vi.mock('../canvas/cv-liveness', () => live);
vi.mock('../team', () => ({ getTeam: vi.fn(async () => []) }));
vi.mock('./broadcast', () => ({ broadcast: vi.fn(), send: vi.fn() }));
vi.mock('../engine/triage', () => ({ killSideRuns: vi.fn(), killSideRunsFor: vi.fn() }));

import { deliverTeamMessage } from './team-deliver';
import { threads, type Thread } from './threads';

const SID = '6ef8f243-a5aa-4082-bb40-29b66e7fa756';
const bot = (id: string, name: string, extra: Partial<TeamBot> = {}): TeamBot => ({ id, name, label: '', instructions: '', mascot: { shape: 'drop', color: '#22c55e' }, profile: 'full', createdAt: 1, updatedAt: 1, ...extra });
const team = [bot('lead1', 'growth-lead'), bot('ativ1', 'growth-ativacao', { sessionId: SID, model: 'sonnet' })];
const msg = { id: 'mabc1234', from: 'lead1', to: 'ativ1', text: 'proponha 1 ação', hop: 2, ts: 1 };

beforeEach(() => {
  threads.clear();
  vi.clearAllMocks();
  runs.isDrainerEnabled.mockReturnValue(false);
});

function fakeThread(sessionId?: string, botId?: string): Thread {
  return { sessionId, params: { botId } } as unknown as Thread;
}

describe('deliverTeamMessage', () => {
  it('starts a server turn on bot-<id>, resuming the bound session, with the bot identity and hop', async () => {
    runs.startRun.mockImplementation(() => { threads.set('bot-ativ1', fakeThread(SID, 'ativ1')); return undefined; });
    expect(await deliverTeamMessage(msg, team)).toBe('delivered');
    const opts = runs.startRun.mock.calls[0][0];
    expect(opts).toMatchObject({
      ws: null, sessionKey: 'bot-ativ1', resumeId: SID, botId: 'ativ1', teamHop: 2, model: 'sonnet', effort: 'low', msgId: 'team-mabc1234',
      prompt: '[Mensagem de growth-lead]\nproponha 1 ação',
    });
    expect(opts.appendSystemPrompt).toMatch(/Você é growth-ativacao/);
  });

  it('runs an unbound bot under bot-<id>', async () => {
    runs.startRun.mockImplementation(() => { threads.set('bot-lead1', fakeThread()); return undefined; });
    expect(await deliverTeamMessage({ ...msg, from: 'ativ1', to: 'lead1' }, team)).toBe('delivered');
    expect(runs.startRun.mock.calls[0][0]).toMatchObject({ sessionKey: 'bot-lead1', resumeId: undefined, botId: 'lead1' });
  });

  it('queues behind a live turn instead of starting a second writer', async () => {
    threads.set('some-tab-key', fakeThread(SID));
    expect(await deliverTeamMessage(msg, team)).toBe('queued');
    expect(runs.startRun).not.toHaveBeenCalled();
    expect(pending.enqueuePending).toHaveBeenCalledWith('some-tab-key', expect.objectContaining({ ws: null, botId: 'ativ1', teamHop: 2, merge: false }));
  });

  it('parks on disk behind a live turn when this process runs the drainer', async () => {
    runs.isDrainerEnabled.mockReturnValue(true);
    threads.set(SID, fakeThread(SID));
    expect(await deliverTeamMessage(msg, team)).toBe('queued');
    expect(parked.addParked).toHaveBeenCalledWith(SID, expect.objectContaining({ resumeId: SID, botId: 'ativ1', teamHop: 2 }));
  });

  it('finds the first turn of an unbound bot under its draft key', async () => {
    threads.set('new-bot-lead1', fakeThread(undefined, 'lead1'));
    expect(await deliverTeamMessage({ ...msg, from: 'ativ1', to: 'lead1' }, team)).toBe('queued');
    expect(runs.startRun).not.toHaveBeenCalled();
  });

  it('parks when the other Deck process is running the session', async () => {
    live.readBusyElsewhereSessionIds.mockResolvedValueOnce([SID]);
    expect(await deliverTeamMessage(msg, team)).toBe('queued');
    expect(parked.addParked).toHaveBeenCalledWith(SID, expect.objectContaining({ resumeId: SID, prompt: expect.stringContaining('proponha') }));
    expect(runs.startRun).not.toHaveBeenCalled();
  });

  it('parks a turn refused for capacity', async () => {
    runs.startRun.mockReturnValue('rejected');
    expect(await deliverTeamMessage(msg, team)).toBe('queued');
    expect(parked.addParked).toHaveBeenCalled();
  });

  it('fails when the recipient left the team', async () => {
    expect(await deliverTeamMessage({ ...msg, to: 'ghost1' }, team)).toBe('failed');
  });
});
