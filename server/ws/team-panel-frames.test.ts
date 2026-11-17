import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { WebSocket } from 'ws';

const m = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('./broadcast', () => ({ send: m.send, broadcast: vi.fn() }));
vi.mock('../team', () => ({ getTeam: async () => [{ id: 'ana1' }] }));
vi.mock('../team-pending', () => ({ readPendingQuestions: () => [] }));
vi.mock('./team-state-frames', () => ({
  teamStateSnapshot: async () => ({ at: 1, followUpHours: 4, handoffs: [], followUps: [], bots: [{ id: 'ana1', name: 'Ana', role: 'dev', status: 'working', task: 'SECRET task' }] }),
}));
vi.mock('../github/prs', () => ({
  getPrsSnapshot: async () => ({
    fetchedAt: 1, merged: [], review: [], mergedSinceDays: 30, mergedTruncated: false,
    mine: [{ url: 'https://github.com/o/secret/pull/1', number: 1, title: 'SECRET pr', repo: 'o/secret', state: 'open', headRef: 'ana1/x', checks: 'success', review: 'none', mergeable: 'ok' }],
  }),
}));

import { _resetTeamPanelClients, pushTeamPanel, sendTeamPanel } from './team-panel-frames';
import { _resetTeamStateClients } from './team-state-push';

const sock = () => new EventEmitter() as unknown as WebSocket;
beforeEach(() => { vi.clearAllMocks(); _resetTeamStateClients(); _resetTeamPanelClients(); });
afterEach(() => { _resetTeamPanelClients(); });

describe('team-panel frames', () => {
  it('ignores a student', async () => {
    await sendTeamPanel(sock(), { t: 'team-panel-get' }, 'student');
    expect(m.send).not.toHaveBeenCalled();
  });

  it('sends the full panel to an admin', async () => {
    const ws = sock();
    await sendTeamPanel(ws, { t: 'team-panel-get' }, 'admin');
    const json = JSON.stringify(m.send.mock.calls[0][1]);
    expect(json).toContain('SECRET task');
    expect(json).toContain('SECRET pr');
  });

  it('redacts on the server when recording, on get and on push', async () => {
    const ws = sock();
    await sendTeamPanel(ws, { t: 'team-panel-get', recording: true }, 'admin');
    await pushTeamPanel();
    expect(m.send).toHaveBeenCalledTimes(2);
    for (const [, frame] of m.send.mock.calls) {
      const json = JSON.stringify(frame);
      expect(json).not.toContain('SECRET');
      expect(json).not.toContain('github');
      expect(json).toContain('Ana');
    }
  });

  it('carries no token-shaped field', async () => {
    await sendTeamPanel(sock(), { t: 'team-panel-get' }, 'admin');
    expect(JSON.stringify(m.send.mock.calls[0][1])).not.toMatch(/token|secretKey|authorization/i);
  });
});
