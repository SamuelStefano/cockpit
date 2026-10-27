import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'deck-cli-heal-'));
process.env.COCKPIT_PARKED = join(dir, 'parked.json');
process.env.COCKPIT_QUEUE_PAUSE = join(dir, 'queue-paused.json');
process.env.COCKPIT_AWAITING = join(dir, 'awaiting.json');

const S = '6ef8f243-a5aa-4082-bb40-29b66e7fa756';
const heal = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock('../engine/cli-update', () => ({ cliUpdater: () => ({ heal: heal.fn }) }));
vi.mock('../db', () => ({ lastUsageOf: () => null }));
vi.mock('../engine/claude', () => ({
  run: vi.fn(() => ({ kill: vi.fn(), send: vi.fn(() => false) })),
  resolveMcpSelection: vi.fn(() => undefined),
}));
vi.mock('./resume', () => ({ resumableId: vi.fn((id?: string) => id) }));
vi.mock('./broadcast', () => ({ broadcast: vi.fn(), send: vi.fn(), setWss: vi.fn() }));
vi.mock('./translate', () => ({ translate: vi.fn() }));
vi.mock('../summary', () => ({ summarize: vi.fn(async () => {}) }));
vi.mock('../engine/triage', () => ({ classify: vi.fn(), quickAnswer: vi.fn(), killSideRuns: vi.fn(), killSideRunsFor: vi.fn() }));
vi.mock('./incidents', () => ({ recordIncident: vi.fn() }));
vi.mock('./recover', () => ({ markRunLive: vi.fn(), clearRunLive: vi.fn(), takeOrphanRuns: vi.fn(() => []) }));
vi.mock('../canvas/orchestrator', () => ({ readOrchestratorSync: () => undefined, isTmuxAliveSync: () => false, paneLostClaudeSync: () => false, tmuxStateSync: () => 'alive' }));

import { startRun, cliHealable } from './runs';
import { threads, type Thread } from './threads';
import { run } from '../engine/claude';
import { broadcast } from './broadcast';

type Opts = Parameters<typeof run>[0];
const lastOpts = (): Opts => vi.mocked(run).mock.calls.at(-1)![0];
const messages = () => vi.mocked(broadcast).mock.calls.map(([m]) => m as { t: string; message?: string });
const flush = () => new Promise((r) => setTimeout(r, 0));

function failTooOld(): void {
  const t = threads.get(S)!;
  t.sessionId = S;
  t.cliTooOld = { required: '2.1.280' };
  lastOpts().onClose();
}

describe('self-heal on "Claude Code X does not support this model"', () => {
  beforeEach(() => {
    threads.clear();
    vi.mocked(run).mockClear();
    vi.mocked(broadcast).mockClear();
    heal.fn.mockReset();
  });

  it('updates the CLI and resends the same prompt once, without the raw 400', async () => {
    heal.fn.mockResolvedValue({ ok: true, from: '2.1.197', to: '2.1.300', message: '' });
    startRun({ ws: null, sessionKey: S, prompt: 'oi', resumeId: S, role: 'admin' } as never);
    failTooOld();
    await flush();
    expect(heal.fn).toHaveBeenCalledWith('2.1.280');
    expect(run).toHaveBeenCalledTimes(2);
    expect(lastOpts()).toMatchObject({ prompt: 'oi', resumeId: S });
    expect(threads.get(S)?.cliRetried).toBe(true);
    const ms = messages();
    expect(ms.some((m) => m.message === 'Claude Code atualizado para 2.1.300; reenviando.')).toBe(true);
    expect(ms.some((m) => m.t === 'done')).toBe(false);
    expect(ms.some((m) => /API Error|does not support/.test(m.message ?? ''))).toBe(false);
  });

  it('retries only once: a second refusal shows the actionable message', async () => {
    heal.fn.mockResolvedValue({ ok: true, from: '2.1.197', to: '2.1.300', message: '' });
    startRun({ ws: null, sessionKey: S, prompt: 'oi', resumeId: S, role: 'admin' } as never);
    failTooOld();
    await flush();
    failTooOld();
    await flush();
    expect(heal.fn).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledTimes(2);
    expect(messages().some((m) => m.t === 'error' && /desatualizado/.test(m.message ?? ''))).toBe(true);
    expect(messages().some((m) => m.t === 'done')).toBe(true);
  });

  it('a failed update closes the turn with what to run', async () => {
    heal.fn.mockResolvedValue({ ok: false, from: '2.1.197', to: '2.1.197', message: 'npm install falhou: EACCES' });
    startRun({ ws: null, sessionKey: S, prompt: 'oi', resumeId: S, role: 'admin' } as never);
    failTooOld();
    await flush();
    expect(run).toHaveBeenCalledOnce();
    const err = messages().find((m) => m.t === 'error')!;
    expect(err.message).toContain('EACCES');
    expect(err.message).toContain('@anthropic-ai/claude-code@latest');
    expect(messages().some((m) => m.t === 'done')).toBe(true);
    expect(threads.has(S)).toBe(false);
  });

  it('does not resend over a turn the user started while updating', async () => {
    let done!: (v: unknown) => void;
    heal.fn.mockReturnValue(new Promise((r) => { done = r; }));
    startRun({ ws: null, sessionKey: S, prompt: 'oi', resumeId: S, role: 'admin' } as never);
    failTooOld();
    startRun({ ws: null, sessionKey: S, prompt: 'outra', resumeId: S, role: 'admin' } as never);
    done({ ok: true, from: '2.1.197', to: '2.1.300', message: '' });
    await flush();
    expect(run).toHaveBeenCalledTimes(2);
    expect(lastOpts().prompt).toBe('outra');
  });
});

describe('cliHealable', () => {
  const base = { tools: [], text: '' } as unknown as Thread;
  it('only a refused turn that did nothing and was not retried yet', () => {
    expect(cliHealable({ ...base, cliTooOld: { required: null } })).toBe(true);
    expect(cliHealable({ ...base })).toBe(false);
    expect(cliHealable({ ...base, cliTooOld: { required: null }, cliRetried: true })).toBe(false);
    expect(cliHealable({ ...base, cliTooOld: { required: null }, userStopped: true })).toBe(false);
    expect(cliHealable({ ...base, cliTooOld: { required: null }, tools: [{}] } as unknown as Thread)).toBe(false);
  });
});
