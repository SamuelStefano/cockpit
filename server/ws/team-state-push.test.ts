import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { WebSocket } from 'ws';

const sent = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('./broadcast', () => ({ send: sent.send, broadcast: vi.fn() }));
const frames = vi.hoisted(() => ({ pushTeamState: vi.fn() }));
vi.mock('./team-state-frames', () => ({ pushTeamState: frames.pushTeamState }));

import { _resetTeamStateClients, emitTeamState, registerTeamStateClient, scheduleTeamStatePush, teamStateWindows } from './team-state-push';

const sock = () => new EventEmitter() as unknown as WebSocket;
const frame = { t: 'team-state', state: { at: 1, followUpHours: 4, bots: [], handoffs: [], followUps: [] } } as const;

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); _resetTeamStateClients(); });
afterEach(() => vi.useRealTimers());

describe('team-state push', () => {
  it('never registers a student, so the push does not reach it', () => {
    const student = sock();
    const admin = sock();
    expect(registerTeamStateClient(student, 'student')).toBe(false);
    expect(registerTeamStateClient(admin, 'admin')).toBe(true);
    emitTeamState(() => frame);
    expect(sent.send).toHaveBeenCalledTimes(1);
    expect(sent.send).toHaveBeenCalledWith(admin, frame);
    expect(sent.send).not.toHaveBeenCalledWith(student, expect.anything());
  });

  it('rejects a connection without a role', () => {
    expect(registerTeamStateClient(sock(), undefined)).toBe(false);
  });

  it('drops a closed socket', () => {
    const admin = sock();
    registerTeamStateClient(admin, 'admin');
    admin.emit('close');
    emitTeamState(() => frame);
    expect(sent.send).not.toHaveBeenCalled();
  });

  it('debounces a burst into one snapshot and skips it with no listeners', async () => {
    scheduleTeamStatePush();
    await vi.advanceTimersByTimeAsync(1500);
    expect(frames.pushTeamState).not.toHaveBeenCalled();
    registerTeamStateClient(sock(), 'admin');
    scheduleTeamStatePush();
    scheduleTeamStatePush();
    scheduleTeamStatePush();
    await vi.advanceTimersByTimeAsync(1500);
    expect(frames.pushTeamState).toHaveBeenCalledTimes(1);
  });

  it('keeps each socket\'s own follow-up window and lets a repeated get replace it', () => {
    const a = sock();
    const b = sock();
    registerTeamStateClient(a, 'admin', 2);
    registerTeamStateClient(b, 'admin', 8);
    expect([...teamStateWindows()].sort()).toEqual([2, 8]);
    emitTeamState((h) => ({ t: 'team-state', state: { ...frame.state, followUpHours: h } }));
    expect(sent.send).toHaveBeenCalledWith(a, expect.objectContaining({ state: expect.objectContaining({ followUpHours: 2 }) }));
    expect(sent.send).toHaveBeenCalledWith(b, expect.objectContaining({ state: expect.objectContaining({ followUpHours: 8 }) }));
    registerTeamStateClient(a, 'admin', 6);
    expect([...teamStateWindows()].sort()).toEqual([6, 8]);
  });
});
