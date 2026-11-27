import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sent = vi.hoisted(() => ({ fn: vi.fn() }));
const computer = vi.hoisted(() => ({ fn: vi.fn() }));
const history = vi.hoisted(() => ({ recordSave: vi.fn(async () => true) }));

vi.mock('./broadcast', () => ({ send: sent.fn }));
vi.mock('../team', () => ({ getTeam: async () => [{ id: 'capo1' }] }));
vi.mock('../team-computer', () => ({ botComputer: computer.fn }));
vi.mock('../agents-repo/history', () => history);

import { ownBotId, saveBotFile, sendBotComputer } from './team-files-frames';

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

  it('student gets step/tool but never the diff, command or terminal of the live view', async () => {
    computer.fn.mockResolvedValue({ ...pane, live: { at: 1, status: 'running', step: 'Testing', stepIndex: 1, stepTotal: 2, tool: 'Edit', command: 'x', file: { path: 'a', diff: 'd', truncated: false }, terminal: ['t'] } });
    await sendBotComputer(ws, 'capo1', 'student');
    const live = (sent.fn.mock.calls[0][1] as any).computer.live;
    expect(live).toEqual({ at: 1, status: 'running', step: 'Testing', stepIndex: 1, stepTotal: 2, tool: 'Edit' });
  });

  it('unknown bot gets nothing', async () => {
    await sendBotComputer(ws, 'other1', 'admin');
    expect(computer.fn).not.toHaveBeenCalled();
  });
});

describe('saveBotFile scoping', () => {
  const ws = { readyState: 1, OPEN: 1 } as unknown as WebSocket;
  beforeEach(() => vi.clearAllMocks());

  it('a student cannot write a bot outside the team', async () => {
    await saveBotFile(ws, 'other1', '.claude/settings.json', '{}', undefined, 'student');
    expect(sent.fn).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'team-file-saved', ok: false, error: 'bot não encontrado' }));
    expect(history.recordSave).not.toHaveBeenCalled();
  });

  it('commits a successful save to the agents repo', async () => {
    process.env.COCKPIT_BOTS_DIR = mkdtempSync(join(tmpdir(), 'bots-'));
    mkdirSync(join(process.env.COCKPIT_BOTS_DIR, 'capo1', 'workspace'), { recursive: true });
    await saveBotFile(ws, 'capo1', 'CLAUDE.md', '# oi', undefined, 'admin');
    expect(sent.fn).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'team-file-saved', ok: true }));
    expect(history.recordSave).toHaveBeenCalledWith('capo1', 'capo1', 'CLAUDE.md');
  });
});
