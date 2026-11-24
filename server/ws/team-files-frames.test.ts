import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';

const sent = vi.hoisted(() => ({ fn: vi.fn() }));
const computer = vi.hoisted(() => ({ fn: vi.fn() }));

vi.mock('./broadcast', () => ({ send: sent.fn }));
vi.mock('../team', () => ({ getTeam: async () => [{ id: 'capo1' }] }));
vi.mock('../team-computer', () => ({ botComputer: computer.fn }));

import { ownBotId, sendBotComputer } from './team-files-frames';

const pane = {
  cwd: '~/bots/capo1/workspace',
  files: 2,
  bytes: 10,
  truncated: false,
  termId: 'bot-capo1',
  termAlive: true,
  preview: ['cat ~/.grok/auth.json', 'sk-secret'],
};

describe('ownBotId', () => {
  it('serves only a bot of the team', () => {
    const team = [{ id: 'capo1' }];
    expect(ownBotId(team, 'capo1')).toBe('capo1');
    expect(ownBotId(team, 'gone11')).toBeUndefined();
    expect(ownBotId(team, 42)).toBeUndefined();
  });
});

describe('sendBotComputer preview policy', () => {
  const ws = { readyState: 1, OPEN: 1 } as unknown as WebSocket;
  beforeEach(() => {
    vi.clearAllMocks();
    computer.fn.mockResolvedValue(pane);
  });

  it('admin receives the pane lines', async () => {
    await sendBotComputer(ws, 'capo1', 'admin');
    expect(sent.fn).toHaveBeenCalledWith(ws, { t: 'team-computer', botId: 'capo1', computer: pane });
  });

  it('student receives cwd/disk/state with an empty preview', async () => {
    await sendBotComputer(ws, 'capo1', 'student');
    expect(sent.fn).toHaveBeenCalledWith(ws, {
      t: 'team-computer',
      botId: 'capo1',
      computer: { ...pane, preview: [] },
    });
  });

  it('missing role is fail-closed (empty preview)', async () => {
    await sendBotComputer(ws, 'capo1');
    const payload = sent.fn.mock.calls[0][1] as { computer: { preview: string[] } };
    expect(payload.computer.preview).toEqual([]);
  });
});
