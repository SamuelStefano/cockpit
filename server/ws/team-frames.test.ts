import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const bc = vi.hoisted(() => ({ send: vi.fn(), broadcast: vi.fn() }));
vi.mock('./broadcast', () => bc);

import { sendTeamMessages, sendTeamPaused, setTeamPause } from './team-frames';
import { appendTeamLog } from '../team-log';

const ws = {} as WebSocket;

beforeEach(() => {
  vi.clearAllMocks();
  const dir = mkdtempSync(join(tmpdir(), 'deck-team-frames-'));
  process.env.COCKPIT_TEAM_LOG = join(dir, 'log.jsonl');
  process.env.COCKPIT_TEAM_PAUSE = join(dir, 'paused.json');
});

describe('team frames', () => {
  it('answers team-messages-get with the pair thread', async () => {
    await appendTeamLog({ id: 'm1', from: 'lead1', to: 'ativ1', text: 'oi', ts: 1, status: 'delivered', hop: 1 });
    await appendTeamLog({ id: 'm2', from: 'lead1', to: 'conv1', text: 'oi', ts: 2, status: 'delivered', hop: 1 });
    await sendTeamMessages(ws, { t: 'team-messages-get', botId: 'lead1', peer: 'ativ1' });
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'team-messages', botId: 'lead1', peer: 'ativ1', items: [expect.objectContaining({ id: 'm1' })] }));
  });

  it('ignores a malformed bot id instead of filtering by it', async () => {
    await appendTeamLog({ id: 'm1', from: 'lead1', to: 'ativ1', text: 'oi', ts: 1, status: 'delivered', hop: 1 });
    await sendTeamMessages(ws, { t: 'team-messages-get', botId: '../x' });
    expect(bc.send.mock.calls[0][1]).toMatchObject({ botId: undefined, items: [expect.objectContaining({ id: 'm1' })] });
  });

  it('persists the pause and broadcasts it to every tab', async () => {
    await setTeamPause(ws, true);
    expect(bc.broadcast).toHaveBeenCalledWith({ t: 'team-paused', paused: true });
    sendTeamPaused(ws);
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'team-paused', paused: true });
  });

  it('rejects a non-boolean pause', async () => {
    await setTeamPause(ws, 'yes');
    expect(bc.broadcast).not.toHaveBeenCalled();
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'error', message: 'pausa inválida' });
  });
});
