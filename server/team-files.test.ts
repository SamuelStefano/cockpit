import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, truncateSync, utimesSync, writeFileSync } from 'node:fs';
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

  it('refuses to read any dot path but the two settings files', async () => {
    const w = ws('capo1');
    mkdirSync(join(w, '.claude')); mkdirSync(join(w, '.git')); mkdirSync(join(w, 'sub/.claude'), { recursive: true });
    for (const f of ['.claude/credentials.json', '.claude/settings.json', '.claude/settings.local.json', '.env', '.git/config', '.mcp.json', 'sub/.claude/settings.json']) writeFileSync(join(w, f), '{}');
    symlinkSync(join(w, '.env'), join(w, 'plain.txt'));
    for (const p of ['.claude/credentials.json', '.env', '.git/config', '.mcp.json', '.hidden', 'sub/.claude/settings.json', './.env', '.claude/./credentials.json', 'mock/../.env', 'plain.txt', '.claude\\credentials.json']) {
      expect(await readBotFile('capo1', p)).toEqual({ error: 'caminho inválido' });
    }
    expect(await readBotFile('capo1', '.claude/settings.json')).toMatchObject({ path: '.claude/settings.json', mime: 'application/json' });
    expect(await readBotFile('capo1', './.claude/settings.local.json')).toMatchObject({ path: '.claude/settings.local.json' });
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

  it('creates the workspace dir when it does not exist yet', async () => {
    expect(existsSync(ws('novo1'))).toBe(false);
    const r = await writeBotFile('novo1', 'notes.md', '# oi');
    expect(r).toMatchObject({ path: 'notes.md' });
    expect(readFileSync(join(ws('novo1'), 'notes.md'), 'utf8')).toBe('# oi');
  });

  it('writes a text file atomically and creates folders', async () => {
    const r = await writeBotFile('capo1', 'skills/x/SKILL.md', '# oi');
    expect(r).toMatchObject({ path: 'skills/x/SKILL.md' });
    expect(readFileSync(join(ws('capo1'), 'skills/x/SKILL.md'), 'utf8')).toBe('# oi');
    expect(readdirSync(join(ws('capo1'), 'skills/x'))).toEqual(['SKILL.md']);
  });

  it('refuses .., absolute paths, NUL and dot segments', async () => {
    for (const p of ['../outside.md', 'a/../../outside.md', '/etc/x.md', 'a\0b.md', '', 'a//b.md']) {
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
  it('refuses backslashes, control chars and paths deeper than the listing', async () => {
    for (const p of ['a\\b.md', 'a\\.claude\\settings.json', 'a\nb.md', 'a/b/c/d/e/f.md']) {
      expect(await writeBotFile('capo1', p, 'x')).toEqual({ error: 'caminho inválido' });
    }
    expect(readdirSync(ws('capo1'))).not.toContain('a');
    expect(await writeBotFile('capo1', 'a/b/c/d/f.md', 'x')).toMatchObject({ path: 'a/b/c/d/f.md' });
    expect(await listBotFiles('capo1')).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'a/b/c/d/f.md' })]));
  });

  it('writes the two settings files, validating JSON', async () => {
    expect(await writeBotFile('capo1', '.claude/settings.json', '{nope')).toEqual({ error: 'json inválido' });
    expect(await writeBotFile('capo1', '.claude/settings.json', '[]')).toEqual({ error: 'json inválido' });
    expect(await writeBotFile('capo1', '.claude/settings.json', '{"permissions":{"allow":["Read"]}}')).toMatchObject({ path: '.claude/settings.json' });
    expect(await writeBotFile('capo1', '.claude/settings.local.json', '{}')).toMatchObject({ path: '.claude/settings.local.json' });
    expect(readFileSync(join(ws('capo1'), '.claude/settings.json'), 'utf8')).toBe('{"permissions":{"allow":["Read"]}}');
    expect(readdirSync(join(ws('capo1'), '.claude')).sort()).toEqual(['settings.json', 'settings.local.json']);
    expect((await listBotFiles('capo1') as { path: string }[]).map((f) => f.path).sort()).toEqual(['.claude/settings.json', '.claude/settings.local.json']);
  });

  it('keeps conflict and symlink guards on settings', async () => {
    const first = await writeBotFile('capo1', '.claude/settings.json', '{}') as { mtime: number };
    expect(await writeBotFile('capo1', '.claude/settings.json', '{}', 5000)).toEqual({ error: 'conflito' });
    expect(await writeBotFile('capo1', '.claude/settings.json', '{"a":1}', first.mtime)).toMatchObject({ path: '.claude/settings.json' });
  });

  it('a non-admin may only tighten: deny/ask rules, nothing that widens the restricted profile', async () => {
    const student = { admin: false };
    const denied = { error: 'só regras deny/ask são editáveis' };
    for (const body of [
      '{"hooks":{}}', '{"env":{"A":"1"}}', '{"permissions":{},"hooks":{}}',
      '{"permissions":{"defaultMode":"bypassPermissions"}}', '{"permissions":{"defaultMode":"dontAsk"}}',
      '{"permissions":{"allow":["Read(//**)"]}}', '{"permissions":{"allow":[]}}',
      '{"permissions":{"additionalDirectories":["/"]}}', '{"permissions":{"deny":["Bash"],"allow":["Write(//**)"]}}',
      '{"__proto__":{"allow":["Read"]}}', '{"permissions":{"__proto__":{"allow":["Read"]}}}',
    ]) expect(await writeBotFile('capo1', '.claude/settings.json', body, undefined, student)).toEqual(denied);
    for (const body of ['{"permissions":{"deny":"Bash"}}', '{"permissions":{"deny":[{"x":1}]}}', '{"permissions":[]}', '{"permissions":null}']) {
      expect(await writeBotFile('capo1', '.claude/settings.local.json', body, undefined, student)).toEqual({ error: 'json inválido' });
    }
    expect(existsSync(join(ws('capo1'), '.claude/settings.json'))).toBe(false);
    expect(await writeBotFile('capo1', '.claude/settings.json', '{"permissions":{"deny":["WebFetch"],"ask":["Write"]}}', undefined, student)).toMatchObject({ path: '.claude/settings.json' });
    expect(await writeBotFile('capo1', '.claude/settings.json', '{}', undefined, student)).toMatchObject({ path: '.claude/settings.json' });
  });

  it('a non-admin cannot replace settings an admin wrote', async () => {
    const adminBody = '{"hooks":{},"permissions":{"allow":["Read"]}}';
    await writeBotFile('capo1', '.claude/settings.json', adminBody);
    expect(await writeBotFile('capo1', '.claude/settings.json', '{}', undefined, { admin: false })).toEqual({ error: 'só o admin edita este arquivo' });
    expect(readFileSync(join(ws('capo1'), '.claude/settings.json'), 'utf8')).toBe(adminBody);
    expect(await writeBotFile('capo1', '.claude/settings.json', '{}')).toMatchObject({ path: '.claude/settings.json' });
  });

  it('lists nothing under .claude but the two settings files', async () => {
    await writeBotFile('capo1', '.claude/settings.json', '{}');
    mkdirSync(join(ws('capo1'), '.claude/skills/x'), { recursive: true });
    writeFileSync(join(ws('capo1'), '.claude/skills/x/SKILL.md'), 's');
    writeFileSync(join(ws('capo1'), '.claude/credentials.json'), '{}');
    writeFileSync(join(ws('capo1'), '.claude/.hidden.json'), '{}');
    mkdirSync(join(ws('capo1'), 'sub/.claude'), { recursive: true });
    writeFileSync(join(ws('capo1'), 'sub/.claude/settings.json'), '{}');
    writeFileSync(join(ws('capo1'), '.mcp.json'), '{}');
    expect((await listBotFiles('capo1') as { path: string }[]).map((f) => f.path).filter((p) => p.includes('.claude') || p.includes('.mcp'))).toEqual(['.claude/settings.json']);
  });

  it('checks the size before parsing settings JSON', async () => {
    const huge = `{"a":"${'x'.repeat(300 * 1024)}"}`;
    expect(await writeBotFile('capo1', '.claude/settings.json', huge)).toEqual({ error: 'arquivo passa de 256KB' });
    expect(await writeBotFile('capo1', '.claude/settings.json', '['.repeat(200000))).toEqual({ error: 'json inválido' });
  });

  it('refuses dot segments at any depth and odd extensions', async () => {
    for (const p of ['x/.claude/settings.json', '.claude/Settings.json', '.claude/other.json', '.claude/settings.json/x', 'x/.mcp.json', '.CLAUDE.md', 'x/..md']) expect(await writeBotFile('capo1', p, 'x')).toEqual({ error: 'caminho inválido' });
    for (const p of ['a.md.', 'a.md ', 'a.md.sh']) expect(await writeBotFile('capo1', p, 'x')).toEqual({ error: 'tipo de arquivo não editável' });
    expect(await writeBotFile('capo1', 'a.md/', 'x')).toEqual({ error: 'caminho inválido' });
    expect(await writeBotFile('capo1', 'UP.MD', 'x')).toMatchObject({ path: 'UP.MD' });
  });

  it('counts the size in bytes, not characters', async () => {
    expect(await writeBotFile('capo1', 'a.md', 'é'.repeat(MAX_BOT_WRITE_BYTES / 2 + 1))).toEqual({ error: 'arquivo passa de 256KB' });
  });

  it('a new file (baseMtime 0) never overwrites one that already exists', async () => {
    writeFileSync(join(ws('capo1'), 'notas.md'), 'do bot');
    expect(await writeBotFile('capo1', 'notas.md', 'do admin', 0)).toEqual({ error: 'conflito' });
    expect(readFileSync(join(ws('capo1'), 'notas.md'), 'utf8')).toBe('do bot');
    expect(await writeBotFile('capo1', 'nova.md', 'x', 0)).toMatchObject({ path: 'nova.md' });
  });

  it('a read carries the mtime a later save is checked against', async () => {
    writeFileSync(join(ws('capo1'), 'r.md'), 'v1');
    const read = await readBotFile('capo1', 'r.md');
    if (!('mtime' in read)) throw new Error('no mtime');
    utimesSync(join(ws('capo1'), 'r.md'), new Date(9000), new Date(9000));
    expect(await writeBotFile('capo1', 'r.md', 'v2', read.mtime)).toEqual({ error: 'conflito' });
  });
});
