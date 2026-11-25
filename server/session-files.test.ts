import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { base, cwd, outside, projects } = vi.hoisted(() => {
  const { mkdtempSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  const base: string = mkdtempSync(join(tmpdir(), 'session-files-'));
  return { base, cwd: join(base, 'proj') as string, outside: join(base, 'outside') as string, projects: join(base, 'projects') as string };
});
const SID = '11111111-2222-3333-4444-555555555555';
const SID_NO_CWD = '11111111-2222-3333-4444-666666666666';

vi.mock('./config', () => ({ CONFIG: { projectsDir: projects, workdir: cwd } }));

import { readSessionFile } from './session-files';
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
  writeFileSync(join(cwd, 'notes.md'), 'token: sk-ant-abcdefghijklmnopqrstuvwxyz0123\n# hi\n');
  writeFileSync(join(cwd, '.env'), 'SECRET=1\n');
  writeFileSync(join(cwd, 'prod.pem'), 'x');
  mkdirSync(join(cwd, '.config', 'gh'), { recursive: true });
  writeFileSync(join(cwd, '.config', 'gh', 'hosts.yml'), 'oauth_token: x\n');
  mkdirSync(join(cwd, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(cwd, '.github', 'workflows', 'ci.yml'), 'on: push\n');
  writeFileSync(join(cwd, '.git-credentials'), 'https://u:p@github.com\n');
  writeFileSync(join(cwd, '.gitignore'), 'node_modules\n');
  writeFileSync(join(projects, `${SID_NO_CWD}.jsonl`), `${JSON.stringify({ type: 'user' })}\n`);
  writeFileSync(join(outside, 'secret.txt'), 'nope');
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
    expect(await readSessionFile(SID, '../outside/secret.txt')).toEqual({ error: 'caminho inválido' });
    expect(await readSessionFile(SID, 'src/../../outside/secret.txt')).toEqual({ error: 'caminho inválido' });
  });

  it('rejects an absolute path outside the cwd', async () => {
    expect(await readSessionFile(SID, join(outside, 'secret.txt'))).toEqual({ error: 'caminho fora da sessão' });
    expect(await readSessionFile(SID, '/etc/passwd')).toHaveProperty('error');
  });

  it('rejects a symlink that escapes the cwd', async () => {
    expect(await readSessionFile(SID, 'link/secret.txt')).toEqual({ error: 'caminho fora da sessão' });
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

describe('session-file-get authz', () => {
  it('is admin-only in v1: a student session could otherwise reach the owner\'s disk', () => {
    expect(authorize('admin', 'session-file-get')).toBe(true);
    expect(authorize('student', 'session-file-get')).toBe(false);
  });
});
