import { describe, expect, it } from 'vitest';
import type { ExecutorState, HeavyJob } from '../shared/heavy-job';
import { formatHeavyJob, formatHeavyList, heavyWaitNote, parseHeavyRun } from './deckctl.mts';

const team = [{ id: 'a1', name: 'Ana' }, { id: 'b2', name: 'Beto' }];
const nameOf = (id: string) => team.find((b) => b.id === id)?.name ?? id;
const job = (over: Partial<HeavyJob> = {}): HeavyJob => ({
  id: 'h1abcdef', repo: 'org/app', branch: 'feat/x', command: 'npm test', requestedBy: 'a1', status: 'done', exitCode: 0, tail: 'ok\n', createdAt: 5, ...over,
});

describe('parseHeavyRun', () => {
  it('splits the command at "--" and joins it', () => {
    expect(parseHeavyRun(team, ['org/app', 'feat/x', '--', 'npm', 'run', 'test'])).toEqual({ repo: 'org/app', branch: 'feat/x', command: 'npm run test', wait: false });
  });
  it('reads --dir, --as and --wait in any order before the separator', () => {
    expect(parseHeavyRun(team, ['--wait', 'org/app', 'main', '--as', 'BETO', '--dir', 'web', '--', 'npm test']))
      .toEqual({ repo: 'org/app', branch: 'main', dir: 'web', command: 'npm test', requestedBy: 'b2', wait: true });
  });
  it('keeps flags written after the separator inside the command', () => {
    expect(parseHeavyRun(team, ['r', 'b', '--', 'npm', 'test', '--wait', '--dir', 'x'])).toMatchObject({ command: 'npm test --wait --dir x', wait: false });
  });
  it.each([
    ['no command', ['r', 'b']],
    ['empty command', ['r', 'b', '--']],
    ['one positional', ['r', '--', 'ls']],
    ['unknown bot', ['r', 'b', '--as', 'zed', '--', 'ls']],
  ])('throws on %s', (_n, args) => {
    expect(() => parseHeavyRun(team, args)).toThrow();
  });
});

describe('heavy formatting', () => {
  it('lists newest first with the requester', () => {
    const rows = formatHeavyList([job({ id: 'old', createdAt: 1 }), job({ id: 'new', createdAt: 9, requestedBy: 'human' })], nameOf);
    expect(rows[0]).toContain('new');
    expect(rows[0]).toContain('you');
    expect(rows[1]).toContain('Ana');
    expect(formatHeavyList([], nameOf)).toEqual(['no jobs yet']);
  });
  it('shows status, command, error and tail', () => {
    const out = formatHeavyJob(job({ status: 'failed', exitCode: 2, error: 'tempo esgotado' }), nameOf).join('\n');
    expect(out).toContain('failed  exit 2');
    expect(out).toContain('$ npm test');
    expect(out).toContain('error: tempo esgotado');
    expect(out).toContain('\nok');
  });
});

describe('heavyWaitNote', () => {
  const ex = (over: Partial<ExecutorState> = {}): ExecutorState => ({ configured: true, label: 'PC', online: false, ...over });
  it('says the job waits for the executor, not that it failed', () => {
    expect(heavyWaitNote(ex(), job({ status: 'queued' }))).toContain('waiting for the executor');
  });
  it('is silent online, running or finished', () => {
    expect(heavyWaitNote(ex({ online: true }), job({ status: 'queued' }))).toBeNull();
    expect(heavyWaitNote(ex(), job({ status: 'running' }))).toBeNull();
    expect(heavyWaitNote(ex(), job({ status: 'done' }))).toBeNull();
  });
});
