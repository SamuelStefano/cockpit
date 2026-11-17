import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executorConfigured, readExecutorConfig } from './heavy-executor';

let dir: string;
const write = (v: unknown) => writeFileSync(process.env.COCKPIT_EXECUTOR as string, typeof v === 'string' ? v : JSON.stringify(v));
const good = { label: 'Build box', probe: ['ssh', 'pc', 'true'], run: ['ssh', 'pc', '{command}'] };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ex-'));
  process.env.COCKPIT_EXECUTOR = join(dir, 'executor.json');
});
afterEach(() => { delete process.env.COCKPIT_EXECUTOR; rmSync(dir, { recursive: true, force: true }); });

describe('readExecutorConfig', () => {
  it('is off when the file is missing', () => {
    expect(readExecutorConfig()).toBeNull();
    expect(executorConfigured()).toBe(false);
  });
  it('applies the defaults', () => {
    write(good);
    expect(readExecutorConfig()).toEqual({ ...good, timeoutMin: 30, stallMin: 10 });
  });
  it('caps the timeout at 180 minutes and ignores nonsense', () => {
    write({ ...good, timeoutMin: 999, stallMin: -4 });
    expect(readExecutorConfig()).toMatchObject({ timeoutMin: 180, stallMin: 10 });
  });
  it('re-reads on every use', () => {
    write(good);
    expect(executorConfigured()).toBe(true);
    write({ ...good, label: 'Outro' });
    expect(readExecutorConfig()?.label).toBe('Outro');
  });
  it.each([
    ['not json', '{nope'],
    ['no label', { ...good, label: '' }],
    ['probe not an array', { ...good, probe: 'ssh pc true' }],
    ['empty run', { ...good, run: [] }],
    ['non-string argv item', { ...good, run: ['ssh', 5] }],
    ['empty argv item', { ...good, probe: [''] }],
  ])('is off for %s', (_n, v) => {
    write(v);
    expect(readExecutorConfig()).toBeNull();
  });
});
