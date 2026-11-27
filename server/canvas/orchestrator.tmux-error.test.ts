import { describe, it, expect, vi } from 'vitest';

const cp = vi.hoisted(() => ({ execFileSync: vi.fn() }));
vi.mock('node:child_process', async (orig) => ({ ...(await orig<typeof import('node:child_process')>()), execFileSync: cp.execFileSync }));

import { isTmuxAliveSync, tmuxStateSync } from './orchestrator';

const fail = (props: object) => () => { throw Object.assign(new Error('tmux'), props); };

describe('isTmuxAliveSync when the check itself fails', () => {
  it('"no such session" (exit 1) and a missing tmux mean dead', () => {
    cp.execFileSync.mockImplementationOnce(fail({ status: 1 }));
    expect(isTmuxAliveSync('cockpit-cv-orch')).toBe(false);
    cp.execFileSync.mockImplementationOnce(fail({ code: 'ENOENT' }));
    expect(isTmuxAliveSync('cockpit-cv-orch')).toBe(false);
  });

  it('a wedged tmux (timeout) or a spawn failure is not "dead" — no headless twin', () => {
    cp.execFileSync.mockImplementationOnce(fail({ code: 'ETIMEDOUT', status: null, signal: 'SIGTERM' }));
    expect(isTmuxAliveSync('cockpit-cv-orch')).toBe(true);
    cp.execFileSync.mockImplementationOnce(fail({ code: 'EAGAIN' }));
    expect(isTmuxAliveSync('cockpit-cv-orch')).toBe(true);
  });

  it('reports unknown so delivery can refuse instead of pasting', () => {
    cp.execFileSync.mockImplementationOnce(fail({ code: 'ETIMEDOUT', status: null }));
    expect(tmuxStateSync('cockpit-cv-orch')).toBe('unknown');
  });
});
