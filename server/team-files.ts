import { lstat, readdir, readFile, realpath, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import type { BotFile } from '../shared/protocol';
import { botWorkspace } from './engine/restricted-profile';

export const MAX_BOT_FILE_BYTES = 10 * 1024 * 1024;
const MAX_LIST = 500;
const MAX_DEPTH = 4;
const MAX_REL_PATH = 512;

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.md': 'text/markdown', '.markdown': 'text/markdown', '.txt': 'text/plain', '.csv': 'text/csv', '.json': 'application/json',
  '.html': 'text/plain', '.ts': 'text/plain', '.tsx': 'text/plain', '.js': 'text/plain', '.py': 'text/plain', '.yml': 'text/plain', '.yaml': 'text/plain',
  '.pdf': 'application/pdf',
};
export const mimeOf = (path: string) => MIME[extname(path).toLowerCase()] ?? 'application/octet-stream';

// Dotfiles stay out of the listing: the CLI keeps its own state (`.claude/`) there.
// Symlinks are skipped, not followed: the listing must never describe a file
// outside the workspace.
export async function listBotFiles(botId: string): Promise<BotFile[] | { error: string }> {
  const ws = botWorkspace(botId);
  if (!ws) return { error: 'bot inválido' };
  const out: BotFile[] = [];
  const walk = async (dir: string, rel: string, depth: number): Promise<void> => {
    let names: string[];
    try { names = await readdir(dir); } catch { return; }
    for (const name of names) {
      if (out.length >= MAX_LIST) return;
      if (name.startsWith('.')) continue;
      const full = join(dir, name);
      const relPath = rel ? `${rel}/${name}` : name;
      const st = await lstat(full).catch(() => null);
      if (!st || st.isSymbolicLink()) continue;
      if (st.isDirectory()) { if (depth < MAX_DEPTH) await walk(full, relPath, depth + 1); continue; }
      if (st.isFile()) out.push({ path: relPath, size: st.size, mtime: st.mtimeMs });
    }
  };
  await walk(ws, '', 0);
  return out.sort((a, b) => b.mtime - a.mtime);
}

// A path the browser sends is untrusted: relative, no `..`, no NUL, and after
// resolving every symlink it must still sit inside THIS bot's workspace.
export function unsafeRelPath(rel: unknown): boolean {
  if (typeof rel !== 'string' || !rel || rel.length > MAX_REL_PATH || rel.includes('\0')) return true;
  if (rel.startsWith('/') || rel.startsWith('\\') || /^[A-Za-z]:/.test(rel)) return true;
  return rel.split(/[\\/]/).some((seg) => seg === '..');
}

export type BotFileRead = { path: string; mime: string; size: number; dataB64: string } | { error: string };

export async function readBotFile(botId: string, rel: unknown): Promise<BotFileRead> {
  const ws = botWorkspace(botId);
  if (!ws) return { error: 'bot inválido' };
  if (unsafeRelPath(rel)) return { error: 'caminho inválido' };
  const path = (rel as string).replace(/^(\.\/)+/, '');
  try {
    const root = await realpath(ws);
    const real = await realpath(resolve(root, path));
    if (!real.startsWith(root + sep)) return { error: 'caminho inválido' };
    const st = await stat(real);
    if (!st.isFile()) return { error: 'não é um arquivo' };
    if (st.size > MAX_BOT_FILE_BYTES) return { error: 'arquivo passa de 10MB' };
    const buf = await readFile(real);
    if (buf.length > MAX_BOT_FILE_BYTES) return { error: 'arquivo passa de 10MB' };
    return { path, mime: mimeOf(real), size: buf.length, dataB64: buf.toString('base64') };
  } catch {
    return { error: 'arquivo não encontrado' };
  }
}
