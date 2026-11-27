import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeBotFile } from '../team-files';
import { botDiff, botLog, headStatus, isVersioned, mirrorBot, recordSave, restoreFile } from './history';
import { git, repoDir } from './git';

let bots: string;
const ws = (id: string) => join(bots, id, 'workspace');

async function save(botId: string, path: string, text: string) {
  const w = await writeBotFile(botId, path, text);
  expect(w).not.toHaveProperty('error');
  return recordSave(botId, 'Atlas', path);
}

describe('agents repo history', () => {
  beforeEach(() => {
    const tmp = mkdtempSync(join(tmpdir(), 'agents-repo-'));
    bots = join(tmp, 'bots');
    process.env.COCKPIT_BOTS_DIR = bots;
    process.env.DECK_AGENT_DIR = join(tmp, 'deck-agent');
    for (const id of ['atlas1', 'pixel1']) mkdirSync(ws(id), { recursive: true });
  });

  it('inits the repo on first save and commits "<bot>: <path>" under <bot-id>/', async () => {
    expect(await save('atlas1', 'CLAUDE.md', '# v1')).toBe(true);
    expect(readFileSync(join(repoDir(), 'atlas1', 'CLAUDE.md'), 'utf8')).toBe('# v1');
    const log = await botLog('atlas1');
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ message: 'Atlas: CLAUDE.md', source: 'deck' });
    expect(await headStatus()).toMatchObject({ head: log[0].hash.slice(0, 7) });
  });

  it('skips an unchanged save and keeps logs per bot', async () => {
    await save('atlas1', 'CLAUDE.md', '# v1');
    expect(await recordSave('atlas1', 'Atlas', 'CLAUDE.md')).toBe(false);
    await save('pixel1', 'notes/a.md', 'pixel');
    expect(await botLog('atlas1')).toHaveLength(1);
    expect(await botLog('pixel1')).toHaveLength(1);
  });

  it('diffs a commit and restores an older version through writeBotFile', async () => {
    await save('atlas1', 'CLAUDE.md', '# v1');
    await save('atlas1', 'CLAUDE.md', '# v2');
    const [second, first] = await botLog('atlas1');
    const d = await botDiff('atlas1', second.hash);
    expect(d).toMatchObject({ files: [{ path: 'CLAUDE.md', old: '# v1', new: '# v2' }] });
    expect('patch' in d && d.patch).toContain('+# v2');
    expect(await restoreFile('atlas1', 'Atlas', first.hash, 'CLAUDE.md')).toMatchObject({ ok: true });
    expect(readFileSync(join(ws('atlas1'), 'CLAUDE.md'), 'utf8')).toBe('# v1');
    expect((await botLog('atlas1'))[0].message).toMatch(/restaurado de/);
  });

  it('refuses bad hashes, bad paths and another bot\'s commit', async () => {
    await save('atlas1', 'CLAUDE.md', '# v1');
    const [c] = await botLog('atlas1');
    expect(await botDiff('atlas1', '--output=/tmp/x')).toEqual({ error: 'versão inválida' });
    expect(await botDiff('pixel1', c.hash)).toEqual({ error: 'versão não encontrada' });
    expect(await botDiff('../x', c.hash)).toEqual({ error: 'bot inválido' });
    expect(await restoreFile('atlas1', 'Atlas', c.hash, '../pixel1/CLAUDE.md')).toEqual({ error: 'caminho inválido' });
    expect(await restoreFile('pixel1', 'Pixel', c.hash, 'CLAUDE.md')).toEqual({ error: 'arquivo não existe nessa versão' });
  });

  it('mirrors only versioned text files and never runs a hook planted in the clone', async () => {
    writeFileSync(join(ws('atlas1'), 'CLAUDE.md'), '# a');
    writeFileSync(join(ws('atlas1'), 'img.png'), 'png');
    writeFileSync(join(ws('atlas1'), 'CLAUDE.remote.md'), 'remote copy');
    await save('pixel1', 'CLAUDE.md', 'seed');
    const marker = join(bots, 'hook-ran');
    mkdirSync(join(repoDir(), '.git', 'hooks'), { recursive: true });
    writeFileSync(join(repoDir(), '.git', 'hooks', 'pre-commit'), `#!/bin/sh\ntouch ${marker}\n`, { mode: 0o755 });
    await git(['config', 'core.hooksPath', '.git/hooks']);
    expect(await mirrorBot('atlas1', 'Atlas')).toBe(true);
    expect(existsSync(marker)).toBe(false);
    expect(existsSync(join(repoDir(), 'atlas1', 'img.png'))).toBe(false);
    expect(existsSync(join(repoDir(), 'atlas1', 'CLAUDE.remote.md'))).toBe(false);
    expect(isVersioned('.claude/settings.json')).toBe(true);
  });
  it('never ships a huge file body in a diff', async () => {
    await save('atlas1', 'CLAUDE.md', '# v1');
    mkdirSync(join(repoDir(), 'atlas1'), { recursive: true });
    writeFileSync(join(repoDir(), 'atlas1', 'big.md'), 'x'.repeat(2 * 1024 * 1024));
    await git(['add', '-A']); await git(['commit', '-qm', 'big']);
    const d = await botDiff('atlas1', (await botLog('atlas1'))[0].hash);
    expect(d).toMatchObject({ files: [{ path: 'big.md', old: '', new: '', tooBig: true }] });
  });

  it('recovers from a stale index.lock left by a killed git', async () => {
    await save('atlas1', 'CLAUDE.md', '# v1');
    const lock = join(repoDir(), '.git', 'index.lock');
    writeFileSync(lock, '');
    utimesSync(lock, new Date(Date.now() - 120_000), new Date(Date.now() - 120_000));
    expect(await save('atlas1', 'CLAUDE.md', '# v2')).toBe(true);
    expect(await botLog('atlas1')).toHaveLength(2);
  });

  it('keeps every one of many concurrent saves', async () => {
    await Promise.all(Array.from({ length: 12 }, (_, i) => save('atlas1', `n${i}.md`, `n${i}`)));
    expect(await botLog('atlas1')).toHaveLength(12);
  });
});
