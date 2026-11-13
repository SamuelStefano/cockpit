import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { agentCwdSync, resolveAgentDir, sourceCloneDir } from './agent-dir';

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'agent-src-')); process.env.COCKPIT_BOTS_DIR = root; });
afterEach(() => { rmSync(root, { recursive: true, force: true }); delete process.env.COCKPIT_BOTS_DIR; });

describe('resolveAgentDir', () => {
  it('resolves an existing folder inside the clone', () => {
    const clone = sourceCloneDir('bot1')!;
    mkdirSync(join(clone, 'team', 'maria'), { recursive: true });
    expect(resolveAgentDir('bot1', { repo: 'a/b', path: 'team/maria' })).toBe(join(clone, 'team', 'maria'));
  });

  it('refuses a folder that is a symlink out of the clone', () => {
    const clone = sourceCloneDir('bot1')!;
    mkdirSync(clone, { recursive: true });
    symlinkSync(tmpdir(), join(clone, 'out'));
    expect(resolveAgentDir('bot1', { repo: 'a/b', path: 'out' })).toBeUndefined();
  });

  it('refuses traversal and a missing folder', () => {
    mkdirSync(sourceCloneDir('bot1')!, { recursive: true });
    expect(resolveAgentDir('bot1', { repo: 'a/b', path: '../..' })).toBeUndefined();
    expect(resolveAgentDir('bot1', { repo: 'a/b', path: 'nope' })).toBeUndefined();
  });

  it('rejects a malformed bot id', () => {
    expect(sourceCloneDir('../x')).toBeUndefined();
  });
});

describe('agentCwdSync', () => {
  it('reads the bot source from the team file', () => {
    mkdirSync(join(sourceCloneDir('bot1')!, 'maria'), { recursive: true });
    const file = join(root, 'team.json');
    writeFileSync(file, JSON.stringify([{ id: 'bot1', source: { repo: 'a/b', path: 'maria' } }, { id: 'bot2' }]));
    expect(agentCwdSync('bot1', file)).toBe(join(sourceCloneDir('bot1')!, 'maria'));
    expect(agentCwdSync('bot2', file)).toBeUndefined();
    expect(agentCwdSync(undefined, file)).toBeUndefined();
  });
});
