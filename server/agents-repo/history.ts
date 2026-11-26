import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import type { WsCommit, WsDiffFile } from '../../shared/protocol';
import { listBotFiles, MAX_BOT_WRITE_BYTES, readBotFile, unsafeRelPath, writeBotFile, WRITABLE_EXT } from '../team-files';
import { botWorkspace } from '../engine/restricted-profile';
import { DECK_AUTHOR, git, locked, repoDir } from './git';

export const HASH_RE = /^[0-9a-f]{7,40}$/;
const MAX_LOG = 100;
const MAX_DIFF_FILES = 20;
const MAX_PATCH = 200 * 1024;

// Conflict copies (`x.remote.md`) live only in the bot workspace, never in history.
export const isVersioned = (path: string): boolean => WRITABLE_EXT.has(extname(path).toLowerCase()) && !/\.remote\.[^/]+$/.test(path);

type Committed = () => void;
let afterCommit: Committed = () => {};
export function onCommitted(fn: Committed): void { afterCommit = fn; }

export async function ensureRepo(): Promise<void> {
  if (existsSync(join(repoDir(), '.git'))) return;
  await mkdir(repoDir(), { recursive: true, mode: 0o700 });
  await git(['init', '-q', '-b', 'main']);
}

const validBot = (botId: string): boolean => !!botWorkspace(botId);

async function mirrorFile(botId: string, rel: string): Promise<void> {
  if (!isVersioned(rel)) return;
  const r = await readBotFile(botId, rel);
  if ('error' in r || r.size > MAX_BOT_WRITE_BYTES) return;
  const dest = join(repoDir(), botId, r.path);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(r.dataB64, 'base64'));
}

async function commitBot(botId: string, message: string): Promise<boolean> {
  await git(['add', '-A', '--', `${botId}/`]);
  const staged = await git(['diff', '--cached', '--name-only', '--', `${botId}/`]);
  if (!staged.trim()) return false;
  await git(['commit', '-q', '-m', message.replace(/[\r\n]+/g, ' ').slice(0, 200), '--', `${botId}/`]);
  return true;
}

export async function mirrorBotUnlocked(botId: string, botName: string): Promise<boolean> {
  if (!validBot(botId)) return false;
  await ensureRepo();
  const files = await listBotFiles(botId);
  if (Array.isArray(files)) for (const f of files) if (f.size <= MAX_BOT_WRITE_BYTES) await mirrorFile(botId, f.path);
  return commitBot(botId, `${botName}: espelho do workspace`);
}

export const mirrorBot = (botId: string, botName: string) => locked(async () => {
  const c = await mirrorBotUnlocked(botId, botName);
  if (c) afterCommit();
  return c;
});

// Called after a successful team-file-put: copies that file into `<bot-id>/` and commits.
export function recordSave(botId: string, botName: string, path: string, message = `${botName}: ${path}`): Promise<boolean> {
  return locked(async () => {
    if (!validBot(botId) || unsafeRelPath(path)) return false;
    await ensureRepo();
    await mirrorFile(botId, path);
    const c = await commitBot(botId, message);
    if (c) afterCommit();
    return c;
  });
}

export function botLog(botId: string): Promise<WsCommit[]> {
  if (!validBot(botId)) return Promise.resolve([]);
  return locked(async () => {
    if (!existsSync(join(repoDir(), '.git'))) return [];
    const out = await git(['log', `-n${MAX_LOG}`, '--format=%H%x1f%s%x1f%ct%x1f%an%x1e', '--', `${botId}/`]).catch(() => '');
    return out.split('\x1e').map((r) => r.trim()).filter(Boolean).map((r) => {
      const [hash, message, ct, author] = r.split('\x1f');
      return { hash, message, at: Number(ct) * 1000, source: author === DECK_AUTHOR ? 'deck' as const : 'github' as const };
    });
  });
}

const show = (spec: string) => git(['show', spec]).catch(() => '');

export type DiffResult = { files: WsDiffFile[]; patch: string } | { error: string };

export function botDiff(botId: string, hash: unknown): Promise<DiffResult> {
  if (!validBot(botId)) return Promise.resolve({ error: 'bot inválido' });
  if (typeof hash !== 'string' || !HASH_RE.test(hash)) return Promise.resolve({ error: 'versão inválida' });
  return locked(async () => {
    const names = await git(['diff-tree', '--no-commit-id', '-r', '--root', '--name-only', hash, '--', `${botId}/`]).catch(() => null);
    if (names === null) return { error: 'versão não encontrada' };
    const paths = names.split('\n').filter(Boolean).slice(0, MAX_DIFF_FILES);
    if (!paths.length) return { error: 'versão não encontrada' };
    const files: WsDiffFile[] = [];
    for (const p of paths) files.push({ path: p.slice(botId.length + 1), old: await show(`${hash}^:${p}`), new: await show(`${hash}:${p}`) });
    const patch = (await git(['show', '--format=', '--no-color', '--no-ext-diff', hash, '--', `${botId}/`]).catch(() => '')).slice(0, MAX_PATCH);
    return { files, patch };
  });
}

// Writes the old version back through writeBotFile, so every workspace guard applies.
export async function restoreFile(botId: string, botName: string, hash: unknown, path: unknown): Promise<{ ok: true; mtime: number } | { error: string }> {
  if (!validBot(botId)) return { error: 'bot inválido' };
  if (typeof hash !== 'string' || !HASH_RE.test(hash)) return { error: 'versão inválida' };
  if (unsafeRelPath(path)) return { error: 'caminho inválido' };
  const rel = path as string;
  const text = await locked(() => git(['show', `${hash}:${botId}/${rel}`]).catch(() => null));
  if (text === null) return { error: 'arquivo não existe nessa versão' };
  const w = await writeBotFile(botId, rel, text, undefined, { admin: true });
  if ('error' in w) return w;
  await recordSave(botId, botName, rel, `${botName}: ${rel} (restaurado de ${hash.slice(0, 7)})`).catch(() => false);
  return { ok: true, mtime: w.mtime };
}

export async function headStatus(): Promise<{ head?: string; at?: number }> {
  if (!existsSync(join(repoDir(), '.git'))) return {};
  const out = await git(['log', '-1', '--format=%h%x1f%ct']).catch(() => '');
  const [head, ct] = out.trim().split('\x1f');
  return head ? { head, at: Number(ct) * 1000 } : {};
}
