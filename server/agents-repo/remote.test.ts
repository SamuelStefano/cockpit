import { describe, it, expect, beforeEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeBotFile } from '../team-files';
import { botDiff, botLog, recordSave } from './history';
import { connectRepo, listInstallationRepos, pushQueued, remoteCopyPath, repoStatus, repoSizeKb, retryDelay, setRepoSizeProbe, syncAll, validRepoName } from './remote';

let tmp: string; let bare: string; let bots: string;
const team = [{ id: 'atlas1', name: 'Atlas' }];
const ws = (id: string) => join(bots, id, 'workspace');
const g = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=Dev', '-c', 'user.email=dev@x', '-C', cwd, ...args], { encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } });

function remoteCommit(path: string, text: string) {
  const work = join(tmp, `work-${Math.random().toString(36).slice(2)}`);
  execFileSync('git', ['clone', '-q', bare, work], { env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } });
  mkdirSync(join(work, path, '..'), { recursive: true });
  writeFileSync(join(work, path), text);
  g(work, 'add', '-A'); g(work, 'commit', '-qm', `edit ${path}`); g(work, 'push', '-q', 'origin', 'HEAD:main');
}

describe('agents repo remote', () => {
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'agents-remote-'));
    bots = join(tmp, 'bots');
    process.env.COCKPIT_BOTS_DIR = bots;
    process.env.DECK_AGENT_DIR = join(tmp, 'deck-agent');
    mkdirSync(ws('atlas1'), { recursive: true });
    bare = join(tmp, 'remote.git');
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
    setRepoSizeProbe(async () => 120);
  });

  it('refuses to connect or sync a repo over 50 MB, or one whose size is unknown', async () => {
    const tokens = async () => [{ account_login: 'demo', token: 't0k', expires_at: '' }];
    const seen: string[] = [];
    const fetchImpl = (async (u: string) => { seen.push(u); return new Response(JSON.stringify({ size: 61 * 1024 })); }) as unknown as typeof fetch;
    expect(await repoSizeKb('demo/deck-agents', { tokens, fetchImpl })).toBe(61 * 1024);
    expect(seen).toEqual(['https://api.github.com/repos/demo/deck-agents']);
    expect(await repoSizeKb('demo/deck-agents', { tokens: async () => [], fetchImpl })).toBeNull();
    setRepoSizeProbe(async () => 61 * 1024);
    const big = { error: 'Repositório grande demais para sincronizar (61 MB, limite 50 MB)' };
    expect(await connectRepo('demo/deck-agents', team, { url: bare })).toEqual(big);
    expect(await repoStatus()).not.toHaveProperty('repo');
    setRepoSizeProbe(async () => 120);
    await connectRepo('demo/deck-agents', team, { url: bare });
    remoteCommit('atlas1/notes/r.md', 'remoto');
    setRepoSizeProbe(async () => 61 * 1024);
    expect(await syncAll(team)).toEqual(big);
    setRepoSizeProbe(async () => null);
    expect(await syncAll(team)).toHaveProperty('error');
    expect(existsSync(join(ws('atlas1'), 'notes/r.md'))).toBe(false);
    setRepoSizeProbe(async () => 120);
    expect(await syncAll(team)).toEqual({ conflicts: [] });
    expect(readFileSync(join(ws('atlas1'), 'notes/r.md'), 'utf8')).toBe('remoto');
  });

  it('validates repo names', () => {
    for (const ok of ['demo/deck-agents', 'a_b/c.d']) expect(validRepoName(ok)).toBe(true);
    for (const bad of ['demo', 'demo/x/y', '../x', 'demo/..', 'a b/c', 'demo/x;rm', 'demo/x\n', '']) expect(validRepoName(bad)).toBe(false);
  });

  it('refuses a repo the installation cannot reach', async () => {
    expect(await connectRepo('demo/other', team, { listRepos: async () => ['demo/deck-agents'] })).toEqual({ error: 'o app do GitHub não tem acesso a esse repositório' });
    expect(await connectRepo('bad name/x', team)).toEqual({ error: 'repositório inválido' });
  });

  it('connects, pushes the local history and pushes each new commit', async () => {
    await writeBotFile('atlas1', 'CLAUDE.md', '# v1');
    await recordSave('atlas1', 'Atlas', 'CLAUDE.md');
    expect(await repoStatus()).not.toHaveProperty('repo');
    expect(await connectRepo('demo/deck-agents', team, { url: bare })).toEqual({ conflicts: [] });
    expect(g(bare, 'log', '--format=%s', 'main')).toContain('Atlas: CLAUDE.md');
    await writeBotFile('atlas1', 'notes/a.md', 'nota');
    await recordSave('atlas1', 'Atlas', 'notes/a.md');
    await pushQueued();
    expect(g(bare, 'show', 'main:atlas1/notes/a.md')).toBe('nota');
    expect(await repoStatus()).toMatchObject({ repo: 'demo/deck-agents', pending: false });
  });

  it('pulls a remote commit into the bot workspace and keeps the bot file on conflict', async () => {
    await writeBotFile('atlas1', 'CLAUDE.md', '# v1');
    await recordSave('atlas1', 'Atlas', 'CLAUDE.md');
    await connectRepo('demo/deck-agents', team, { url: bare });
    remoteCommit('atlas1/skills/review.md', 'do repo');
    remoteCommit('atlas1/CLAUDE.md', '# remoto');
    remoteCommit('pixel9/CLAUDE.md', 'bot de fora');
    await writeBotFile('atlas1', 'CLAUDE.md', '# local');
    expect(await syncAll(team)).toEqual({ conflicts: [{ botId: 'atlas1', path: 'CLAUDE.md' }] });
    expect(readFileSync(join(ws('atlas1'), 'skills/review.md'), 'utf8')).toBe('do repo');
    expect(readFileSync(join(ws('atlas1'), 'CLAUDE.md'), 'utf8')).toBe('# local');
    expect(readFileSync(join(ws('atlas1'), 'CLAUDE.remote.md'), 'utf8')).toBe('# remoto');
    expect(existsSync(join(bots, 'pixel9'))).toBe(false);
    expect((await botLog('atlas1')).some((c) => c.source === 'github')).toBe(true);
    expect(g(bare, 'show', 'main:atlas1/CLAUDE.md')).toBe('# local');
  });

  it('never widens bot settings from the repo', async () => {
    await connectRepo('demo/deck-agents', team, { url: bare });
    remoteCommit('atlas1/.claude/settings.json', JSON.stringify({ permissions: { allow: ['Bash'] } }));
    expect(await syncAll(team)).toEqual({ conflicts: [{ botId: 'atlas1', path: '.claude/settings.json' }] });
    expect(existsSync(join(ws('atlas1'), '.claude/settings.json'))).toBe(false);
    expect(existsSync(join(ws('atlas1'), 'claude-settings.remote.json'))).toBe(true);
  });

  it('never follows a symlink committed in the repo', async () => {
    const victim = join(tmp, 'victim.txt');
    writeFileSync(victim, 'safe');
    await connectRepo('demo/deck-agents', team, { url: bare });
    const work = join(tmp, 'evil');
    execFileSync('git', ['clone', '-q', bare, work], { env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } });
    mkdirSync(join(work, 'atlas1/notes'), { recursive: true });
    symlinkSync(victim, join(work, 'atlas1/notes/x.md'));
    symlinkSync(tmp, join(work, 'atlas1/skills'));
    g(work, 'add', '-A'); g(work, 'commit', '-qm', 'links'); g(work, 'push', '-q', 'origin', 'HEAD:main');
    await syncAll(team);
    expect(existsSync(join(ws('atlas1'), 'notes/x.md'))).toBe(false);
    await writeBotFile('atlas1', 'notes/x.md', 'pwned');
    await recordSave('atlas1', 'Atlas', 'notes/x.md');
    await writeBotFile('atlas1', 'skills/victim.txt', 'pwned');
    await recordSave('atlas1', 'Atlas', 'skills/victim.txt');
    expect(readFileSync(victim, 'utf8')).toBe('safe');
  });

  it('pulls a file with a non-ASCII name', async () => {
    await connectRepo('demo/deck-agents', team, { url: bare });
    remoteCommit('atlas1/notes/anotações.md', 'oi');
    expect(await syncAll(team)).toEqual({ conflicts: [] });
    expect(readFileSync(join(ws('atlas1'), 'notes/anotações.md'), 'utf8')).toBe('oi');
    const [c] = await botLog('atlas1');
    expect(await botDiff('atlas1', c.hash)).toMatchObject({ files: [{ path: 'notes/anotações.md', new: 'oi' }] });
  });

  it('diffs the merge commit of a sync and reports no conflict without a copy', async () => {
    await writeBotFile('atlas1', 'CLAUDE.md', '# v1');
    await recordSave('atlas1', 'Atlas', 'CLAUDE.md');
    await connectRepo('demo/deck-agents', team, { url: bare });
    remoteCommit('atlas1/notes/big.md', 'x'.repeat(300 * 1024));
    remoteCommit('atlas1/notes/r.md', 'remoto');
    await writeBotFile('atlas1', 'notes/l.md', 'local');
    expect(await syncAll(team)).toEqual({ conflicts: [] });
    for (const c of await botLog('atlas1')) expect(await botDiff('atlas1', c.hash)).not.toHaveProperty('error');
  });

  it('survives a file deleted in the repo and edited in the Deck', async () => {
    await writeBotFile('atlas1', 'CLAUDE.md', '# v1');
    await recordSave('atlas1', 'Atlas', 'CLAUDE.md');
    await connectRepo('demo/deck-agents', team, { url: bare });
    const work = join(tmp, 'del');
    execFileSync('git', ['clone', '-q', bare, work], { env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } });
    g(work, 'rm', '-q', 'atlas1/CLAUDE.md'); g(work, 'commit', '-qm', 'rm'); g(work, 'push', '-q', 'origin', 'HEAD:main');
    await writeBotFile('atlas1', 'CLAUDE.md', '# v2');
    expect(await syncAll(team)).not.toHaveProperty('error');
    expect(readFileSync(join(ws('atlas1'), 'CLAUDE.md'), 'utf8')).toBe('# v2');
    expect(g(bare, 'show', 'main:atlas1/CLAUDE.md')).toBe('# v2');
  });

  it('fetches an existing repo shallow and never truncates the local history later', async () => {
    const seed = join(tmp, 'seed');
    execFileSync('git', ['clone', '-q', `file://${bare}`, seed], { env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } });
    for (let i = 0; i < 60; i++) g(seed, 'commit', '-q', '--allow-empty', '-m', `old ${i}`);
    g(seed, 'push', '-q', 'origin', 'HEAD:main');
    await connectRepo('demo/deck-agents', team, { url: `file://${bare}` });
    expect(readFileSync(join(process.env.DECK_AGENT_DIR!, 'agents-repo/.git/shallow'), 'utf8').trim()).toMatch(/^[0-9a-f]{40}$/);
    for (let i = 0; i < 55; i++) { await writeBotFile('atlas1', 'CLAUDE.md', `v${i}`); await recordSave('atlas1', 'Atlas', 'CLAUDE.md'); }
    await pushQueued();
    remoteCommit('atlas1/notes/r.md', 'remoto');
    expect(await syncAll(team)).toEqual({ conflicts: [] });
    expect(await botLog('atlas1')).toHaveLength(56);
  });

  it('queues the push when the remote is offline', async () => {
    await connectRepo('demo/deck-agents', team, { url: join(tmp, 'missing.git') });
    await writeBotFile('atlas1', 'CLAUDE.md', '# v1');
    await recordSave('atlas1', 'Atlas', 'CLAUDE.md');
    expect(await pushQueued()).toBe(false);
    expect(await repoStatus()).toMatchObject({ pending: true });
    expect([1, 2, 3, 9].map(retryDelay)).toEqual([60_000, 120_000, 240_000, 600_000]);
  });

  it('lists installation repos server-side with deck-agents first', async () => {
    const seen: string[] = [];
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      seen.push(String((init.headers as Record<string, string>).authorization));
      return new Response(JSON.stringify({ repositories: [{ full_name: 'demo/web' }, { full_name: 'demo/deck-agents' }, { full_name: 'bad name' }] }));
    }) as unknown as typeof fetch;
    expect(await listInstallationRepos({ tokens: async () => [{ account_login: 'demo', token: 't0k', expires_at: '' }], fetchImpl })).toEqual(['demo/deck-agents', 'demo/web']);
    expect(seen).toEqual(['Bearer t0k']);
    expect(remoteCopyPath('.claude/settings.local.json')).toBe('claude-settings.local.remote.json');
  });
});
