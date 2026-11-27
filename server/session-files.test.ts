import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { base, cwd, outside, projects } = vi.hoisted(() => {
  const { mkdtempSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  const base: string = mkdtempSync(join(tmpdir(), 'session-files-'));
  const cwd: string = join(base, 'proj');
  // Same rule as the CLI: the projects dir is the slug of the start cwd.
  return { base, cwd, outside: join(base, 'outside') as string, projects: join(base, cwd.replace(/[/\\:.]/g, '-')) as string };
});
const SID = '11111111-2222-3333-4444-555555555555';
const SID_NO_CWD = '11111111-2222-3333-4444-666666666666';
const SID_DECOY = '11111111-2222-3333-4444-777777777777';
const SID_FOREIGN = '11111111-2222-3333-4444-888888888888';
const SID_BIG_HEAD = '11111111-2222-3333-4444-999999999999';
const SID_MOVED = '11111111-2222-3333-4444-aaaaaaaaaaaa';

vi.mock('./config', async (orig) => ({ ...(await orig<typeof import('./config')>()), CONFIG: { projectsDir: projects, workdir: cwd } }));

import { isDeniedSessionPath, MAX_SESSION_TEXT_BYTES, readSessionFile } from './session-files';
import { authorize } from './ws/authz';

const text = (r: Awaited<ReturnType<typeof readSessionFile>>) => {
  if ('error' in r) throw new Error(r.error);
  return Buffer.from(r.dataB64, 'base64').toString('utf8');
};

beforeAll(() => {
  mkdirSync(join(cwd, 'src'), { recursive: true });
  mkdirSync(outside, { recursive: true });
  mkdirSync(projects, { recursive: true });
  writeFileSync(join(projects, `${SID}.jsonl`), `${JSON.stringify({ type: 'user', cwd })}\n`);
  writeFileSync(join(cwd, 'src', 'x.ts'), 'export const a = 1;\n');
  writeFileSync(join(cwd, 'notes.md'), 'token: sk-' + 'ant-' + 'a'.repeat(30) + '\n# hi\n');
  writeFileSync(join(cwd, '.env'), 'SECRET=1\n');
  writeFileSync(join(cwd, 'prod.pem'), 'x');
  mkdirSync(join(cwd, '.config', 'gh'), { recursive: true });
  writeFileSync(join(cwd, '.config', 'gh', 'hosts.yml'), 'oauth_token: x\n');
  mkdirSync(join(cwd, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(cwd, '.github', 'workflows', 'ci.yml'), 'on: push\n');
  writeFileSync(join(cwd, '.git-credentials'), 'https://u:p@github.com\n');
  writeFileSync(join(cwd, '.gitignore'), 'node_modules\n');
  writeFileSync(join(projects, `${SID_NO_CWD}.jsonl`), `${JSON.stringify({ type: 'user' })}\n`);
  writeFileSync(join(outside, 'private.txt'), 'nope');
  const jsonl = (id: string, ...recs: unknown[]) => writeFileSync(join(projects, `${id}.jsonl`), recs.map((r) => JSON.stringify(r)).join('\n') + '\n');
  // A nested "cwd" (tool input) written BEFORE the top-level field of the same record.
  jsonl(SID_DECOY, { type: 'queue-operation', content: '"cwd":"/"' }, { type: 'assistant', message: { content: [{ type: 'tool_use', input: { cwd: '/' } }] }, cwd });
  jsonl(SID_FOREIGN, { type: 'user', cwd: '/' });
  jsonl(SID_BIG_HEAD, { type: 'user', message: { content: 'x'.repeat(300_000) }, cwd });
  jsonl(SID_MOVED, { type: 'user', cwd }, { type: 'assistant', cwd: join(cwd, 'src') }, { type: 'assistant', cwd: outside });
  jsonl('11111111-2222-3333-4444-bbbbbbbbbbbb', { type: 'user', cwd }, { type: 'assistant', cwd: join(cwd, 'src') });
  writeFileSync(join(cwd, '.env.production.local'), 'SECRET=1\n');
  writeFileSync(join(cwd, 'prod.tfvars'), 'db_password = "hunter2hunter2"\n');
  writeFileSync(join(cwd, 'Makefile'), 'deploy:\n\tcurl -H "Authorization: Bearer abcdefghijklmnop123456"\n');
  writeFileSync(join(cwd, 'logo.svg'), '<svg><!-- gh' + 'p_' + 'b'.repeat(36) + ' --></svg>');
  writeFileSync(join(cwd, 'latin1.txt'), Buffer.from([0x63, 0x61, 0x66, 0xe9]));
  writeFileSync(join(cwd, 'odd.txt'), 'a\uFFFDb\n');
  writeFileSync(join(cwd, 'data.bin'), Buffer.from([1, 2, 0, 3, 4]));
  writeFileSync(join(cwd, 'doc.pdf'), Buffer.from([0x25, 0x50, 0x44, 0x46, 0, 1, 2]));
  writeFileSync(join(cwd, 'big.log'), 'line of log text\n'.repeat(60_000));
  symlinkSync(outside, join(cwd, 'link'));
  symlinkSync(join(cwd, '.env'), join(cwd, 'env-alias.txt'));
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('readSessionFile', () => {
  it('reads a relative file inside the session cwd', async () => {
    expect(text(await readSessionFile(SID, 'src/x.ts'))).toBe('export const a = 1;\n');
  });

  it('reads an absolute path that sits inside the cwd', async () => {
    expect(text(await readSessionFile(SID, join(cwd, 'src', 'x.ts')))).toContain('export');
  });

  it('redacts secrets in text content', async () => {
    const out = text(await readSessionFile(SID, 'notes.md'));
    expect(out).not.toContain('sk-ant-');
    expect(out).toContain('# hi');
  });

  it('rejects ../ traversal', async () => {
    expect(await readSessionFile(SID, '../outside/private.txt')).toEqual({ error: 'caminho inválido' });
    expect(await readSessionFile(SID, 'src/../../outside/private.txt')).toEqual({ error: 'caminho inválido' });
  });

  it('rejects an absolute path outside the cwd', async () => {
    expect(await readSessionFile(SID, join(outside, 'private.txt'))).toEqual({ error: 'caminho fora da sessão' });
    expect(await readSessionFile(SID, '/etc/passwd')).toEqual({ error: 'caminho fora da sessão' });
    expect(await readSessionFile(SID, '~/x.txt')).toEqual({ error: 'caminho fora da sessão' });
  });

  it('answers the same for an outside path that exists and one that does not', async () => {
    expect(await readSessionFile(SID, join(outside, 'nope.txt'))).toEqual(await readSessionFile(SID, join(outside, 'private.txt')));
  });

  it('rejects a symlink that escapes the cwd like a missing file', async () => {
    expect(await readSessionFile(SID, 'link/private.txt')).toEqual({ error: 'arquivo não encontrado' });
    expect(await readSessionFile(SID, 'link/nope.txt')).toEqual({ error: 'arquivo não encontrado' });
  });

  it('ignores a nested or quoted "cwd" that comes before the real field', async () => {
    expect(text(await readSessionFile(SID_DECOY, 'src/x.ts'))).toContain('export');
    expect(await readSessionFile(SID_DECOY, '/etc/passwd')).toEqual({ error: 'caminho fora da sessão' });
  });

  it('does not trust a cwd that is not the one this projects dir belongs to', async () => {
    expect(await readSessionFile(SID_FOREIGN, 'etc/passwd')).toEqual({ error: 'sessão não encontrada' });
  });

  it('finds the cwd behind a first record larger than any head window', async () => {
    expect(text(await readSessionFile(SID_BIG_HEAD, 'src/x.ts'))).toContain('export');
  });

  it('resolves a relative path against where the CLI is now, never outside the start cwd', async () => {
    expect(text(await readSessionFile('11111111-2222-3333-4444-bbbbbbbbbbbb', 'x.ts'))).toContain('export');
    expect(text(await readSessionFile('11111111-2222-3333-4444-bbbbbbbbbbbb', 'notes.md'))).toContain('# hi');
    expect(await readSessionFile(SID_MOVED, 'private.txt')).toEqual({ error: 'arquivo não encontrado' });
  });

  it('redacts text whatever the extension, svg included', async () => {
    const mk = await readSessionFile(SID, 'Makefile');
    expect(mk).toMatchObject({ mime: 'text/plain' });
    expect(text(mk)).not.toContain('abcdefghijklmnop123456');
    expect(text(await readSessionFile(SID, 'logo.svg'))).not.toContain('ghp_');
  });

  it('does not ship bytes that have no preview', async () => {
    expect(await readSessionFile(SID, 'latin1.txt')).toEqual({ error: 'sem prévia pra este tipo de arquivo' });
    expect(text(await readSessionFile(SID, 'odd.txt'))).toBe('a\uFFFDb\n');
    expect(await readSessionFile(SID, 'data.bin')).toEqual({ error: 'sem prévia pra este tipo de arquivo' });
    expect(await readSessionFile(SID, 'doc.pdf')).toEqual({ error: 'sem prévia pra este tipo de arquivo' });
  });

  it('cuts a large text file at a line boundary and says so', async () => {
    const r = await readSessionFile(SID, 'big.log');
    if ('error' in r) throw new Error(r.error);
    expect(r.truncated).toBe(true);
    expect(r.size).toBe(60_000 * 17);
    const out = Buffer.from(r.dataB64, 'base64').toString('utf8');
    expect(out.length).toBeLessThanOrEqual(MAX_SESSION_TEXT_BYTES);
    expect(out.endsWith('line of log text\n')).toBe(true);
  });

  it('denies env variants and secret stores isSensitivePath misses', async () => {
    expect(await readSessionFile(SID, '.env.production.local')).toEqual({ error: 'arquivo sensível' });
    expect(await readSessionFile(SID, 'prod.tfvars')).toEqual({ error: 'arquivo sensível' });
    for (const p of ['/h/p/.ENV', '/h/p/.Env.Local', '/h/p/.envrc', '/h/.SSH/id_x', '/h/p/.env.', '/h/p/.env::$DATA', 'C:\\p\\.aws\\credentials', '/h/p/terraform.tfstate', '/h/p/secrets.yaml', '/h/p/.Config/gh/hosts.yml']) expect(isDeniedSessionPath(p), p).toBe(true);
    for (const p of ['/h/p/src/secrets.ts', '/h/p/src/environment.ts', '/h/p/.GitHub/workflows/ci.yml', '/h/p/README.md', '/h/p/src/env.d.ts']) expect(isDeniedSessionPath(p), p).toBe(false);
  });

  it('denies .env and key files inside the cwd, also through a symlink', async () => {
    expect(await readSessionFile(SID, '.env')).toEqual({ error: 'arquivo sensível' });
    expect(await readSessionFile(SID, 'prod.pem')).toEqual({ error: 'arquivo sensível' });
    expect(await readSessionFile(SID, 'env-alias.txt')).toEqual({ error: 'arquivo sensível' });
  });

  it('denies hidden directories ($HOME cwd: ~/.config, ~/.dfl-mcp...) but keeps .github and plain dotfiles', async () => {
    expect(await readSessionFile(SID, '.config/gh/hosts.yml')).toEqual({ error: 'arquivo sensível' });
    expect(await readSessionFile(SID, '.git-credentials')).toEqual({ error: 'arquivo sensível' });
    expect(text(await readSessionFile(SID, '.github/workflows/ci.yml'))).toContain('on: push');
    expect(text(await readSessionFile(SID, '.gitignore'))).toContain('node_modules');
  });

  it('serves nothing when the session has no cwd (no fallback to the Deck workdir)', async () => {
    expect(await readSessionFile(SID_NO_CWD, 'src/x.ts')).toEqual({ error: 'sessão não encontrada' });
  });

  it('denies a session the caller cannot resolve', async () => {
    expect(await readSessionFile('../../etc', 'src/x.ts')).toEqual({ error: 'sessão não encontrada' });
    expect(await readSessionFile('99999999-2222-3333-4444-555555555555', 'src/x.ts')).toEqual({ error: 'sessão não encontrada' });
    expect(await readSessionFile(undefined, 'src/x.ts')).toEqual({ error: 'sessão inválida' });
  });

  it('rejects NUL and empty paths and directories', async () => {
    expect(await readSessionFile(SID, 'a\0b')).toEqual({ error: 'caminho inválido' });
    expect(await readSessionFile(SID, '')).toEqual({ error: 'caminho inválido' });
    expect(await readSessionFile(SID, 'src')).toEqual({ error: 'não é um arquivo' });
  });
});

describe('session-file-get rate limit', () => {
  it('is a heavy frame', async () => {
    const { createRateLimiter } = await import('./ws/guard');
    const l = createRateLimiter(() => 0);
    let ok = 0;
    for (let i = 0; i < 40; i++) if (l.allow('session-file-get')) ok++;
    expect(ok).toBe(15);
  });
});

describe('session-file-get authz', () => {
  it('is admin-only in v1: a student session could otherwise reach the owner\'s disk', () => {
    expect(authorize('admin', 'session-file-get')).toBe(true);
    expect(authorize('student', 'session-file-get')).toBe(false);
  });
});
