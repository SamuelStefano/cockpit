import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import type { ClientMsg, TeamBot } from '../../shared/protocol';

const runs = vi.hoisted(() => ({
  startRun: vi.fn(),
  routeSend: vi.fn((_opts: unknown) => Promise.resolve()),
  orchestratorPaneTarget: vi.fn(() => undefined),
  fireCron: vi.fn(async (): Promise<string> => 'started'),
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

const crons = vi.hoisted(() => ({
  getCrons: vi.fn(async () => []),
  saveCron: vi.fn(async (c: unknown) => [c]),
  deleteCron: vi.fn(async () => []),
  runCronNow: vi.fn(async (_id: string, fire: (c: unknown) => unknown) => { fire({ id: 'r1' }); return [{ id: 'r1' }]; }),
  pauseBotRoutines: vi.fn(async (): Promise<unknown[] | null> => null),
}));
vi.mock('../crons', () => crons);

import { handle } from './dispatch';
import type { Cron } from '../../shared/protocol';

const ws = {} as WebSocket;
const capo = { id: 'capo1', name: 'capo', label: '', instructions: '', mascot: { shape: 'drop', color: '#22c55e' }, profile: 'full', createdAt: 1, updatedAt: 1 } as TeamBot;
const routine: Cron = { id: 'r1', name: 'métricas', prompt: 'puxe', schedule: { kind: 'interval', everyMinutes: 5 }, enabled: true, createdAt: 1, botId: 'capo1' };

beforeEach(() => { vi.clearAllMocks(); team.getTeam.mockResolvedValue([capo]); });

describe('bot routine frames', () => {
  it('saves a routine of an existing bot', async () => {
    await handle(ws, { t: 'cron-save', cron: routine }, 'admin');
    expect(crons.saveCron).toHaveBeenCalledWith(routine);
  });

  it('rejects a routine of a bot that does not exist', async () => {
    await handle(ws, { t: 'cron-save', cron: { ...routine, botId: 'ghost1' } }, 'admin');
    expect(crons.saveCron).not.toHaveBeenCalled();
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'error', message: 'bot não encontrado' });
  });

  it('rejects a bot routine under 5 minutes', async () => {
    await handle(ws, { t: 'cron-save', cron: { ...routine, schedule: { kind: 'interval', everyMinutes: 4 } } }, 'admin');
    expect(crons.saveCron).not.toHaveBeenCalled();
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'error', message: expect.stringMatching(/mínimo a cada 5 min/) });
  });

  it('keeps the 1-minute floor for a plain cron', async () => {
    await handle(ws, { t: 'cron-save', cron: { ...routine, botId: undefined, schedule: { kind: 'interval', everyMinutes: 1 } } }, 'admin');
    expect(crons.saveCron).toHaveBeenCalledOnce();
    expect(team.getTeam).not.toHaveBeenCalled();
  });

  it('pauses the routines of a deleted bot and broadcasts them', async () => {
    crons.pauseBotRoutines.mockResolvedValueOnce([{ ...routine, enabled: false }]);
    await handle(ws, { t: 'team-delete', id: 'capo1' }, 'admin');
    expect(crons.pauseBotRoutines).toHaveBeenCalledWith('capo1');
    expect(bc.broadcast).toHaveBeenCalledWith({ t: 'crons', items: [{ ...routine, enabled: false }] });
  });

  it('tells the user when "run now" finds the bot busy', async () => {
    runs.fireCron.mockResolvedValueOnce('bot-busy');
    await handle(ws, { t: 'cron-run', id: 'r1' }, 'admin');
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'crons', items: [{ id: 'r1' }] });
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'error', message: expect.stringMatching(/meio de um turno/) });
  });
});

describe('student on bot routines (fatia E)', () => {
  const free: Cron = { ...routine, id: 'f1', botId: undefined };

  it('crons-get shows a student only the bot routines', async () => {
    crons.getCrons.mockResolvedValueOnce([routine, free] as never);
    await handle(ws, { t: 'crons-get' }, 'student');
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'crons', items: [routine] });
  });

  it('cron-save: a student may save a bot routine, mode pinned to auto and no ACP model', async () => {
    await handle(ws, { t: 'cron-save', cron: { ...routine, mode: 'acceptEdits', model: 'agent:grok' } }, 'student');
    const saved = crons.saveCron.mock.calls[0][0] as Cron;
    expect(saved).toMatchObject({ id: 'r1', botId: 'capo1', mode: 'auto' });
    expect(saved.model).toBeUndefined();
  });

  it('cron-save: a student may not create a free cron', async () => {
    await handle(ws, { t: 'cron-save', cron: free }, 'student');
    expect(crons.saveCron).not.toHaveBeenCalled();
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'error', message: 'só rotinas de bot da Equipe' });
  });

  it('cron-save: a student may not overwrite a free cron by reusing its id', async () => {
    crons.getCrons.mockResolvedValueOnce([free] as never);
    await handle(ws, { t: 'cron-save', cron: { ...routine, id: 'f1' } }, 'student');
    expect(crons.saveCron).not.toHaveBeenCalled();
  });

  it('cron-delete and cron-run: refused on a free cron, allowed on a routine', async () => {
    crons.getCrons.mockResolvedValue([routine, free] as never);
    await handle(ws, { t: 'cron-delete', id: 'f1' }, 'student');
    await handle(ws, { t: 'cron-run', id: 'f1' }, 'student');
    expect(crons.deleteCron).not.toHaveBeenCalled();
    expect(crons.runCronNow).not.toHaveBeenCalled();
    await handle(ws, { t: 'cron-delete', id: 'r1' }, 'student');
    await handle(ws, { t: 'cron-run', id: 'r1' }, 'student');
    expect(crons.deleteCron).toHaveBeenCalledWith('r1');
    expect(crons.runCronNow).toHaveBeenCalledOnce();
    crons.getCrons.mockResolvedValue([]);
  });

  it('admin still saves a free cron', async () => {
    await handle(ws, { t: 'cron-save', cron: { ...free, schedule: { kind: 'interval', everyMinutes: 10 } } }, 'admin');
    expect(crons.saveCron).toHaveBeenCalledOnce();
  });
});
