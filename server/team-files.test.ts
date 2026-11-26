import { describe, it, expect, beforeEach } from 'vitest';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, truncateSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listBotFiles, readBotFile, unsafeRelPath, writeBotFile, MAX_BOT_FILE_BYTES, MAX_BOT_WRITE_BYTES } from './team-files';

let root: string;
const ws = (id: string) => join(root, id, 'workspace');

describe('bot files', () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'bots-'));
    process.env.COCKPIT_BOTS_DIR = root;
    for (const id of ['capo1', 'lead1']) mkdirSync(ws(id), { recursive: true });
    writeFileSync(join(ws('capo1'), 'old.md'), '# velho');
    utimesSync(join(ws('capo1'), 'old.md'), new Date(1000), new Date(1000));
    mkdirSync(join(ws('capo1'), 'mock'));
    writeFileSync(join(ws('capo1'), 'mock', 'tela.png'), 'png');
    writeFileSync(join(ws('capo1'), '.hidden'), 'x');
    writeFileSync(join(ws('lead1'), 'secret.txt'), 'do outro bot');
    writeFileSync(join(root, 'outside.txt'), 'fora');
  });

  it('lists the workspace newest first, skipping dotfiles and symlinks', async () => {
    symlinkSync(join(root, 'outside.txt'), join(ws('capo1'), 'link.txt'));
    const r = await listBotFiles('capo1');
    expect(Array.isArray(r) && r.map((f) => f.path)).toEqual(['mock/tela.png', 'old.md']);
  });

  it('reads a file inside the workspace with its mime', async () => {
    const r = await readBotFile('capo1', './mock/tela.png');
    expect(r).toMatchObject({ path: 'mock/tela.png', mime: 'image/png', size: 3 });
    expect('dataB64' in r && Buffer.from(r.dataB64, 'base64').toString()).toBe('png');
  });

  it('refuses .., absolute paths and another bot', async () => {
    for (const p of ['../outside.txt', 'mock/../../lead1/workspace/secret.txt', '/etc/hostname', join(ws('lead1'), 'secret.txt'), 'a\0b', '']) {
      expect(unsafeRelPath(p)).toBe(true);
      expect(await readBotFile('capo1', p)).toEqual({ error: 'caminho inválido' });
    }
    expect(await readBotFile('../capo1', 'old.md')).toEqual({ error: 'bot inválido' });
  });

  it('refuses a symlink that points outside, even to another bot', async () => {
    symlinkSync(join(root, 'outside.txt'), join(ws('capo1'), 'out.txt'));
    symlinkSync(ws('lead1'), join(ws('capo1'), 'peer'));
    expect(await readBotFile('capo1', 'out.txt')).toEqual({ error: 'caminho inválido' });
    expect(await readBotFile('capo1', 'peer/secret.txt')).toEqual({ error: 'caminho inválido' });
  });

  it('refuses a file over 10MB and a directory', async () => {
    const big = join(ws('capo1'), 'big.bin');
    writeFileSync(big, '');
    truncateSync(big, MAX_BOT_FILE_BYTES + 1);
    expect(await readBotFile('capo1', 'big.bin')).toEqual({ error: 'arquivo passa de 10MB' });
    expect(await readBotFile('capo1', 'mock')).toEqual({ error: 'não é um arquivo' });
  });
});

describe('writeBotFile', () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'bots-'));
    process.env.COCKPIT_BOTS_DIR = root;
    mkdirSync(ws('capo1'), { recursive: true });
    writeFileSync(join(root, 'outside.md'), 'fora');
  });

  it('writes a text file atomically and creates folders', async () => {
    const r = await writeBotFile('capo1', 'skills/x/SKILL.md', '# oi');
    expect(r).toMatchObject({ path: 'skills/x/SKILL.md' });
    expect(readFileSync(join(ws('capo1'), 'skills/x/SKILL.md'), 'utf8')).toBe('# oi');
    expect(readdirSync(join(ws('capo1'), 'skills/x'))).toEqual(['SKILL.md']);
  });

  it('refuses .., absolute paths, NUL and dot segments', async () => {
    for (const p of ['../outside.md', 'a/../../outside.md', '/etc/x.md', 'a\0b.md', '', '.claude/settings.json', 'a//b.md']) {
      expect(await writeBotFile('capo1', p, 'x')).toEqual({ error: 'caminho inválido' });
    }
    expect(readFileSync(join(root, 'outside.md'), 'utf8')).toBe('fora');
  });

  it('refuses a non-text extension', async () => {
    for (const p of ['run.sh', 'a.ts', 'x.png', 'noext']) expect(await writeBotFile('capo1', p, 'x')).toEqual({ error: 'tipo de arquivo não editável' });
  });

  it('refuses symlinks escaping the root, as dir or as file', async () => {
    mkdirSync(join(root, 'outdir'));
    symlinkSync(join(root, 'outdir'), join(ws('capo1'), 'link'));
    symlinkSync(join(root, 'outside.md'), join(ws('capo1'), 'f.md'));
    expect(await writeBotFile('capo1', 'link/x.md', 'x')).toEqual({ error: 'caminho inválido' });
    expect(await writeBotFile('capo1', 'link/new/x.md', 'x')).toEqual({ error: 'caminho inválido' });
    expect(await writeBotFile('capo1', 'f.md', 'x')).toEqual({ error: 'caminho inválido' });
    expect(readdirSync(join(root, 'outdir'))).toEqual([]);
    expect(readFileSync(join(root, 'outside.md'), 'utf8')).toBe('fora');
  });

  it('refuses unknown bot, NUL text and oversize content', async () => {
    expect(await writeBotFile('../x', 'a.md', 'x')).toEqual({ error: 'bot inválido' });
    expect(await writeBotFile('capo1', 'a.md', 'a\0b')).toEqual({ error: 'conteúdo inválido' });
    expect(await writeBotFile('capo1', 'a.md', 'x'.repeat(MAX_BOT_WRITE_BYTES + 1))).toEqual({ error: 'arquivo passa de 256KB' });
  });

  it('returns conflito when the file changed since baseMtime', async () => {
    const first = await writeBotFile('capo1', 'CLAUDE.md', 'v1');
    if (!('mtime' in first)) throw new Error('no mtime');
    utimesSync(join(ws('capo1'), 'CLAUDE.md'), new Date(5000), new Date(5000));
    expect(await writeBotFile('capo1', 'CLAUDE.md', 'v2', first.mtime)).toEqual({ error: 'conflito' });
    expect(readFileSync(join(ws('capo1'), 'CLAUDE.md'), 'utf8')).toBe('v1');
    expect(await writeBotFile('capo1', 'CLAUDE.md', 'v3', 5000)).toMatchObject({ path: 'CLAUDE.md' });
  });
});
