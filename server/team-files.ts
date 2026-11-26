import { lstat, mkdir, readdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import type { BotFile } from '../shared/protocol';
import { isBotSettingsPath, parseSettingsText, settingsDeniedForStudent } from '../shared/bot-settings';
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

// Dotfiles stay out of the listing: the CLI keeps its own state there. The one
// exception is the two settings files under `.claude/` the user may edit.
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
      // Inside `.claude/` only the two settings files exist for the listing:
      // skills, agents and the CLI's own state stay out, dot-named or not.
      if (rel === '.claude' ? !isBotSettingsPath(`${rel}/${name}`) : name.startsWith('.') && !(depth === 0 && name === '.claude')) continue;
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

// Same match as writes: the CLI's state and config (`.claude/…`, `.env`, `.git/…`,
// `.mcp.json`) are never served, only the two editable settings files.
const dotPathRefused = (path: string): boolean => !isBotSettingsPath(path) && path.split(/[\\/]/).some((s) => s.startsWith('.'));

export type BotFileRead = { path: string; mime: string; size: number; mtime: number; dataB64: string } | { error: string };

export async function readBotFile(botId: string, rel: unknown): Promise<BotFileRead> {
  const ws = botWorkspace(botId);
  if (!ws) return { error: 'bot inválido' };
  if (unsafeRelPath(rel)) return { error: 'caminho inválido' };
  const path = (rel as string).replace(/^(\.\/)+/, '');
  if (dotPathRefused(path)) return { error: 'caminho inválido' };
  try {
    const root = await realpath(ws);
    const real = await realpath(resolve(root, path));
    if (!real.startsWith(root + sep)) return { error: 'caminho inválido' };
    // Checked again after realpath: a plain-named symlink must not reach a dotfile.
    if (dotPathRefused(real.slice(root.length + 1).split(sep).join('/'))) return { error: 'caminho inválido' };
    const st = await stat(real);
    if (!st.isFile()) return { error: 'não é um arquivo' };
    if (st.size > MAX_BOT_FILE_BYTES) return { error: 'arquivo passa de 10MB' };
    const buf = await readFile(real);
    if (buf.length > MAX_BOT_FILE_BYTES) return { error: 'arquivo passa de 10MB' };
    return { path, mime: mimeOf(real), size: buf.length, mtime: st.mtimeMs, dataB64: buf.toString('base64') };
  } catch {
    return { error: 'arquivo não encontrado' };
  }
}

export const MAX_BOT_WRITE_BYTES = 256 * 1024;
const WRITABLE_EXT = new Set(['.md', '.txt', '.json', '.yaml', '.yml']);

export type BotFileWrite = { path: string; mtime: number } | { error: string };

// Writes only text files the bot's own CLI never treats as config: dot segments
// (`.git/…`, `.mcp.json`) are refused. The only dot paths allowed are the bot's
// `.claude/settings.json` and `.claude/settings.local.json`, JSON-validated; for a
// non-admin only deny/ask rules may be written (`admin: false`). The parent dir is realpath-checked, the target itself must
// not be a symlink, and the bytes land through tmp + rename.
// `baseMtime` is the mtime of the copy the editor started from; 0 means "new
// file", so it conflicts with anything already there.
export async function writeBotFile(botId: string, rel: unknown, text: unknown, baseMtime?: unknown, opts: { admin?: boolean } = { admin: true }): Promise<BotFileWrite> {
  const ws = botWorkspace(botId);
  if (!ws) return { error: 'bot inválido' };
  if (unsafeRelPath(rel)) return { error: 'caminho inválido' };
  const path = (rel as string).replace(/^(\.\/)+/, '');
  // A backslash or control char is a legal Linux file name: it would land as one
  // odd file at the root while the folder loop below created its "parents".
  if (/[\\\x00-\x1f\x7f]/.test(path)) return { error: 'caminho inválido' };
  const segs = path.split('/');
  const settings = isBotSettingsPath(path);
  if (!settings && segs.some((s) => !s || s.startsWith('.'))) return { error: 'caminho inválido' };
  // Deeper than the listing walks would be a file nobody can open again.
  if (segs.length - 1 > MAX_DEPTH) return { error: 'caminho inválido' };
  if (!WRITABLE_EXT.has(extname(path).toLowerCase())) return { error: 'tipo de arquivo não editável' };
  if (typeof text !== 'string' || text.includes('\0')) return { error: 'conteúdo inválido' };
  // Size first: the JSON checks below must never parse an oversized frame.
  if (text.length > MAX_BOT_WRITE_BYTES) return { error: 'arquivo passa de 256KB' };
  const buf = Buffer.from(text, 'utf8');
  if (buf.length > MAX_BOT_WRITE_BYTES) return { error: 'arquivo passa de 256KB' };
  if (settings) {
    if (!parseSettingsText(text).ok) return { error: 'json inválido' };
    if (!opts.admin) { const denied = settingsDeniedForStudent(text); if (denied) return { error: denied }; }
  }
  let root: string;
  try { root = await realpath(ws); } catch { return { error: 'workspace não encontrado' }; }
  const target = resolve(root, path);
  const parent = dirname(target);
  try {
    let dir = root;
    for (const seg of segs.slice(0, -1)) {
      dir = join(dir, seg);
      const st = await lstat(dir).catch(() => null);
      if (!st) await mkdir(dir);
      else if (!st.isDirectory()) return { error: 'caminho inválido' };
    }
    const realParent = await realpath(parent);
    if (realParent !== root && !realParent.startsWith(root + sep)) return { error: 'caminho inválido' };
    const dest = join(realParent, basename(target));
    const cur = await lstat(dest).catch(() => null);
    if (cur && !cur.isFile()) return { error: 'caminho inválido' };
    // A non-admin never replaces settings an admin wrote (hooks, env, allow rules).
    if (settings && !opts.admin && cur && (cur.size > MAX_BOT_WRITE_BYTES || settingsDeniedForStudent(await readFile(dest, 'utf8')))) return { error: 'só o admin edita este arquivo' };
    if (typeof baseMtime === 'number' && cur && Math.abs(cur.mtimeMs - baseMtime) > 1) return { error: 'conflito' };
    const tmp = join(realParent, `.${basename(target)}.${process.pid}.${Date.now()}.tmp`);
    await writeFile(tmp, buf, { flag: 'wx', mode: 0o644 });
    try { await rename(tmp, dest); } catch (e) { await rm(tmp, { force: true }); throw e; }
    return { path, mtime: (await stat(dest)).mtimeMs };
  } catch {
    return { error: 'não foi possível salvar' };
  }
}
