import { describe, it, expect, beforeEach } from 'vitest';
import { mkdirSync, mkdtempSync, symlinkSync, truncateSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listBotFiles, readBotFile, unsafeRelPath, MAX_BOT_FILE_BYTES } from './team-files';

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
