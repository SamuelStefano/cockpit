import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { gitError, syncAgentSource, syncIsFresh, SYNC_TTL_MS } from './agent-source';
import { sourceCloneDir } from './agent-dir';

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'agent-src-')); process.env.COCKPIT_BOTS_DIR = root; });
afterEach(() => { rmSync(root, { recursive: true, force: true }); delete process.env.COCKPIT_BOTS_DIR; });

describe('syncAgentSource', () => {
  it('clones sparse on the folder from main and reports the commit', async () => {
    const calls: string[][] = [];
    const git = async (args: string[], cwd?: string) => {
      calls.push(args);
      if (args[0] === 'reset') mkdirSync(join(cwd!, 'maria'), { recursive: true });
      return args[0] === 'rev-parse' ? 'abc1234' : '';
    };
    const r = await syncAgentSource('bot1', { repo: 'a/b', path: 'maria' }, git);
    expect(r).toMatchObject({ commit: 'abc1234' });
    expect(r.error).toBeUndefined();
    expect(calls).toContainEqual(['remote', 'add', 'origin', 'https://github.com/a/b.git']);
    expect(calls).toContainEqual(['sparse-checkout', 'set', '--no-cone', '/maria/']);
    expect(calls).toContainEqual(['fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', 'main']);
  });

  it('reports a folder missing from main', async () => {
    const r = await syncAgentSource('bot1', { repo: 'a/b', path: 'maria' }, async () => '');
    expect(r.error).toMatch(/não existe/);
  });

  it('maps git failures to a message without stderr', async () => {
    const r = await syncAgentSource('bot1', { repo: 'a/b', path: '' }, async () => { throw Object.assign(new Error('x'), { stderr: 'remote: Repository not found. https://user:secret@github.com' }); });
    expect(r.error).toBe('repositório não encontrado ou sem acesso');
    expect(gitError(new Error('weird'))).toBe('não deu pra sincronizar o repositório');
  });
});

describe('syncIsFresh', () => {
  it('is fresh only for a recent successful sync', () => {
    expect(syncIsFresh({ sourceSync: { at: 1000 } }, 1000 + SYNC_TTL_MS - 1)).toBe(true);
    expect(syncIsFresh({ sourceSync: { at: 1000 } }, 1000 + SYNC_TTL_MS)).toBe(false);
    expect(syncIsFresh({ sourceSync: { at: 1000, error: 'x' } }, 1001)).toBe(false);
    expect(syncIsFresh({}, 0)).toBe(false);
  });
});
