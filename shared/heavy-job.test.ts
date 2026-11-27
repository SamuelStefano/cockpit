import { describe, expect, it } from 'vitest';
import {
  HEAVY_LIMITS, appendTail, buildArgv, coerceJob, finishJob, jobExitCode, newJob, nextJob, stalledSince, validateJobInput, type HeavyJob,
} from './heavy-job';

const ok = { repo: 'org/app', branch: 'feat/x', command: 'npm test' };

describe('validateJobInput', () => {
  it('accepts a plain job and trims', () => {
    expect(validateJobInput({ ...ok, repo: ' org/app ', dir: 'packages/web' })).toEqual({ ok: true, input: { ...ok, dir: 'packages/web' } });
  });
  it('treats an empty dir as absent', () => {
    expect(validateJobInput({ ...ok, dir: '' })).toEqual({ ok: true, input: ok });
  });
  it.each([
    ['repo with space', { repo: 'a b' }],
    ['repo with two slashes', { repo: 'a/b/c' }],
    ['repo too long', { repo: 'a'.repeat(HEAVY_LIMITS.repo + 1) }],
    ['branch with ..', { branch: 'a/../b' }],
    ['branch starting with -', { branch: '-rf' }],
    ['branch with shell chars', { branch: 'a;b' }],
    ['branch too long', { branch: 'a'.repeat(HEAVY_LIMITS.branch + 1) }],
    ['absolute dir', { dir: '/etc' }],
    ['dir with ..', { dir: 'a/../..' }],
    ['dir starting with -', { dir: '-x' }],
    ['dir with space', { dir: 'a b' }],
    ['empty command', { command: '   ' }],
    ['newline in command', { command: 'a\nb' }],
    ['NUL in command', { command: 'a\0b' }],
    ['command too long', { command: 'x'.repeat(HEAVY_LIMITS.command + 1) }],
    ['non-string command', { command: 5 }],
  ])('rejects %s', (_n, over) => {
    expect(validateJobInput({ ...ok, ...over }).ok).toBe(false);
  });
  it('rejects non-objects', () => {
    expect(validateJobInput(null).ok).toBe(false);
  });
});

describe('buildArgv', () => {
  it('substitutes whole elements and parts of one element', () => {
    expect(buildArgv(['ssh', 'pc', 'run', '{repo}@{branch}', '--dir={dir}', '{command}'], { ...ok, dir: 'web' }))
      .toEqual(['ssh', 'pc', 'run', 'org/app@feat/x', '--dir=web', 'npm test']);
  });
  it('defaults dir to a dot', () => {
    expect(buildArgv(['{dir}'], ok)).toEqual(['.']);
  });
  it('never re-expands substituted text and keeps one element per placeholder', () => {
    expect(buildArgv(['x', '{command}'], { ...ok, command: 'echo {repo}; rm -rf /' })).toEqual(['x', 'echo {repo}; rm -rf /']);
  });
  it('does not touch a template without placeholders', () => {
    expect(buildArgv(['a', '{other}'], ok)).toEqual(['a', '{other}']);
  });
});

describe('appendTail', () => {
  it('keeps the last 4000 chars', () => {
    const t = appendTail('a'.repeat(3990), 'b'.repeat(20));
    expect(t).toHaveLength(HEAVY_LIMITS.tail);
    expect(t.endsWith('b'.repeat(20))).toBe(true);
  });
  it('leaves short output whole', () => {
    expect(appendTail('ab', 'cd')).toBe('abcd');
  });
});

const job = (id: string, status: HeavyJob['status'], createdAt: number): HeavyJob => ({ ...newJob(id, ok, 'human', createdAt), status });

describe('nextJob', () => {
  it('is the oldest queued job', () => {
    expect(nextJob([job('c', 'queued', 3), job('a', 'queued', 1), job('b', 'running', 0)])?.id).toBe('a');
  });
  it('is undefined with nothing queued', () => {
    expect(nextJob([job('a', 'done', 1)])).toBeUndefined();
  });
});

describe('stalledSince', () => {
  const min = 60_000;
  it('stays unset before the wait reaches the limit', () => {
    expect(stalledSince([job('a', 'queued', 0)], false, 10 * min, 9 * min)).toBeUndefined();
  });
  it('is set at the limit and then held', () => {
    expect(stalledSince([job('a', 'queued', 0)], false, 10 * min, 10 * min)).toBe(10 * min);
    expect(stalledSince([job('a', 'queued', 0)], false, 10 * min, 20 * min, 10 * min)).toBe(10 * min);
  });
  it('clears when online, unknown or nothing waits', () => {
    expect(stalledSince([job('a', 'queued', 0)], true, min, 5 * min, min)).toBeUndefined();
    expect(stalledSince([job('a', 'queued', 0)], null, min, 5 * min, min)).toBeUndefined();
    expect(stalledSince([job('a', 'done', 0)], false, min, 5 * min, min)).toBeUndefined();
  });
});

describe('finishJob and exit codes', () => {
  it('records status, exit code and truncates the error', () => {
    const j = finishJob(job('a', 'running', 0), 'failed', 9, { exitCode: 2, error: 'x'.repeat(300) });
    expect(j).toMatchObject({ status: 'failed', exitCode: 2, endedAt: 9 });
    expect(j.error).toHaveLength(200);
  });
  it('maps to a process exit code', () => {
    expect(jobExitCode({ status: 'done' })).toBe(0);
    expect(jobExitCode({ status: 'failed', exitCode: 7 })).toBe(7);
    expect(jobExitCode({ status: 'failed' })).toBe(1);
    expect(jobExitCode({ status: 'cancelled' })).toBe(130);
  });
});

describe('coerceJob', () => {
  it('fills requestedBy and tail, rejects junk', () => {
    expect(coerceJob({ id: 'a', repo: 'r', branch: 'b', command: 'c', status: 'queued', createdAt: 1 })).toMatchObject({ requestedBy: 'human', tail: '' });
    expect(coerceJob({ id: 'a', status: 'weird' })).toBeNull();
    expect(coerceJob(null)).toBeNull();
  });
});
