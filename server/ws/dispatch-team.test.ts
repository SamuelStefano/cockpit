import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import type { ClientMsg, TeamBot } from '../../shared/protocol';

const runs = vi.hoisted(() => ({
  startRun: vi.fn(),
  routeSend: vi.fn((_opts: unknown) => Promise.resolve()),
  orchestratorPaneTarget: vi.fn(() => undefined),
  fireCron: vi.fn(),
  drainParked: vi.fn(),
}));
vi.mock('./runs', () => runs);
const bc = vi.hoisted(() => ({ send: vi.fn(), broadcast: vi.fn() }));
vi.mock('./broadcast', () => bc);
const team = vi.hoisted(() => ({
  getTeam: vi.fn(async (): Promise<TeamBot[]> => []),
  saveBot: vi.fn(async (): Promise<{ ok: true; bots: TeamBot[] } | { ok: false; error: string }> => ({ ok: true, bots: [] })),
  deleteBot: vi.fn(async (): Promise<TeamBot[]> => []),
  bindBotSession: vi.fn(),
}));
vi.mock('../team', () => team);
vi.mock('../skills', () => ({ listSkills: vi.fn(async () => []), readSkill: vi.fn(), resolveSkillDeny: vi.fn(async () => []) }));
vi.mock('../canvas/term-stats', () => ({
  collectTermStats: vi.fn(), collectCtxOnly: vi.fn(), hasInteractiveClaude: vi.fn(async () => false), newCpuSamples: vi.fn(() => new Map()),
}));
vi.mock('../canvas/cv-liveness', () => ({
  readBusyElsewhereSessionIds: vi.fn(async () => []), readBusyHeadlessElsewhereSessionIds: vi.fn(async () => []), refreshLivenessSnapshot: vi.fn(),
}));

import { handle } from './dispatch';

const ws = {} as WebSocket;
const SID = '11111111-1111-1111-1111-111111111111';
const capo: TeamBot = {
  id: 'capo1', name: 'capo', label: 'coo', instructions: 'coordene', mascot: { shape: 'drop', color: '#22c55e' },
  profile: 'full', primary: true, createdAt: 1, updatedAt: 1,
};
const input = { id: 'capo1', name: 'capo', label: 'coo', instructions: '', mascot: { shape: 'drop', color: '#22c55e' }, profile: 'full' };

beforeEach(() => { vi.clearAllMocks(); });

describe('team frames', () => {
  it('team-get answers only the asking socket', async () => {
    team.getTeam.mockResolvedValueOnce([capo]);
    await handle(ws, { t: 'team-get' }, 'admin');
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'team', bots: [capo] });
  });

  it('team-save validates the raw frame and broadcasts the list', async () => {
    team.saveBot.mockResolvedValueOnce({ ok: true, bots: [capo] });
    await handle(ws, { t: 'team-save', bot: { ...input, sessionId: 'forged', createdAt: 0 } } as unknown as ClientMsg, 'admin');
    expect(team.saveBot).toHaveBeenCalledOnce();
    expect(team.saveBot.mock.calls[0]).toEqual([expect.not.objectContaining({ sessionId: expect.anything() })]);
    expect(bc.broadcast).toHaveBeenCalledWith({ t: 'team', bots: [capo] });
  });

  it.each([
    ['name too long', { name: 'x'.repeat(41) }],
    ['bad color', { mascot: { shape: 'drop', color: 'red' } }],
    ['bad shape', { mascot: { shape: 'star', color: '#ffffff' } }],
    ['instructions over 8KB', { instructions: 'a'.repeat(8 * 1024 + 1) }],
  ])('team-save rejects %s without touching the store', async (_n, over) => {
    await handle(ws, { t: 'team-save', bot: { ...input, ...over } } as unknown as ClientMsg, 'admin');
    expect(team.saveBot).not.toHaveBeenCalled();
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'error' }));
  });

  it('team-save surfaces a store refusal (cycle) as an error', async () => {
    team.saveBot.mockResolvedValueOnce({ ok: false, error: 'essa chefia formaria um ciclo' });
    await handle(ws, { t: 'team-save', bot: input } as unknown as ClientMsg, 'admin');
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'error', message: 'essa chefia formaria um ciclo' });
    expect(bc.broadcast).not.toHaveBeenCalled();
  });

  it('team-delete broadcasts the remaining list', async () => {
    await handle(ws, { t: 'team-delete', id: 'capo1' }, 'admin');
    expect(team.deleteBot).toHaveBeenCalledWith('capo1');
    expect(bc.broadcast).toHaveBeenCalledWith({ t: 'team', bots: [] });
  });
});

describe('send into a bot thread', () => {
  const send = (over: Partial<Extract<ClientMsg, { t: 'send' }>>): ClientMsg =>
    ({ t: 'send', sessionKey: 'new-bot-capo1', text: 'oi', msgId: 'm1', model: 'opus', ...over }) as ClientMsg;

  it('first turn: identity injected, no resume yet', async () => {
    team.getTeam.mockResolvedValueOnce([capo]);
    await handle(ws, send({}), 'admin');
    const o = runs.startRun.mock.calls[0][0];
    expect(o).toMatchObject({ sessionKey: 'new-bot-capo1', botId: 'capo1', resumeId: undefined });
    expect(o.appendSystemPrompt).toContain('Você é capo, coo');
    expect(o.appendSystemPrompt).toContain('coordene');
  });

  it('a draft key resumes the bound session, and the bot pins its model', async () => {
    team.getTeam.mockResolvedValueOnce([{ ...capo, sessionId: SID, model: 'sonnet' }]);
    await handle(ws, send({}), 'admin');
    expect(runs.startRun.mock.calls[0][0]).toMatchObject({ resumeId: SID, model: 'sonnet', botId: 'capo1' });
  });

  it('a plain send into the bound session still speaks as the bot', async () => {
    team.getTeam.mockResolvedValueOnce([{ ...capo, sessionId: SID }]);
    await handle(ws, send({ sessionKey: SID, sessionId: SID }), 'admin');
    expect(runs.startRun.mock.calls[0][0]).toMatchObject({ sessionKey: SID, resumeId: SID, botId: 'capo1' });
  });

  it('a normal session gets no identity', async () => {
    team.getTeam.mockResolvedValueOnce([{ ...capo, sessionId: SID }]);
    await handle(ws, send({ sessionKey: 'k1', sessionId: '22222222-2222-2222-2222-222222222222' }), 'admin');
    const o = runs.startRun.mock.calls[0][0];
    expect(o.botId).toBeUndefined();
    expect(o.appendSystemPrompt).toBeUndefined();
  });
});

describe('student on the Equipe (fatia E)', () => {
  const send = (over: Partial<Extract<ClientMsg, { t: 'send' }>> = {}): ClientMsg =>
    ({ t: 'send', sessionKey: 'new-bot-capo1', text: 'oi', msgId: 'm1', ...over }) as ClientMsg;

  it('a bot saved by a student is always restricted, auto, without an ACP agent', async () => {
    await handle(ws, { t: 'team-save', bot: { ...input, profile: 'full', mode: 'acceptEdits', model: 'agent:grok' } } as unknown as ClientMsg, 'student');
    const saved = (team.saveBot.mock.calls as unknown as [TeamBot][])[0][0];
    expect(saved).toMatchObject({ profile: 'restricted', mode: 'auto' });
    expect(saved.model).toBeUndefined();
  });

  it('admin keeps the profile it chose', async () => {
    await handle(ws, { t: 'team-save', bot: { ...input, profile: 'full', mode: 'acceptEdits' } } as unknown as ClientMsg, 'admin');
    expect((team.saveBot.mock.calls as unknown as [TeamBot][])[0][0]).toMatchObject({ profile: 'full', mode: 'acceptEdits' });
  });

  it('nobody stores a restricted bot on an ACP agent', async () => {
    await handle(ws, { t: 'team-save', bot: { ...input, profile: 'restricted', model: 'agent:grok' } } as unknown as ClientMsg, 'admin');
    expect(team.saveBot).not.toHaveBeenCalled();
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'error', message: expect.stringMatching(/agente externo/) });
  });

  it("a student's turn on a bot stored as full still runs restricted", async () => {
    team.getTeam.mockResolvedValueOnce([capo]);
    await handle(ws, send(), 'student');
    expect(runs.startRun.mock.calls[0][0]).toMatchObject({ botId: 'capo1', profile: 'restricted' });
  });

  it("admin's turn follows the stored profile", async () => {
    team.getTeam.mockResolvedValueOnce([capo]);
    await handle(ws, send(), 'admin');
    expect(runs.startRun.mock.calls[0][0]).toMatchObject({ botId: 'capo1', profile: 'full' });
  });

  it('queue-add on a bot carries the restricted profile into the parked item', async () => {
    team.getTeam.mockResolvedValueOnce([{ ...capo, profile: 'restricted' }]);
    await handle(ws, { t: 'queue-add', sessionKey: 'new-bot-capo1', text: 'depois' } as ClientMsg, 'admin');
    const { loadParked } = await import('./parked');
    const items = loadParked()['new-bot-capo1'] ?? [];
    expect(items.at(-1)).toMatchObject({ botId: 'capo1', profile: 'restricted' });
  });
});
