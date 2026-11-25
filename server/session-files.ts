import { open, readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, resolve, sep } from 'node:path';
import { CONFIG } from './config';
import { isSensitivePath, redactSecrets } from './redact-secrets';
import { MAX_BOT_FILE_BYTES, mimeOf } from './team-files';

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_PATH = 1024;
const HEAD_BYTES = 64 * 1024;

// Extensions the bot-file mime table does not know but that are plain text.
const TEXT_EXT = new Set(['.css', '.scss', '.sh', '.bash', '.zsh', '.rs', '.go', '.java', '.rb', '.php', '.c', '.h', '.cpp', '.hpp', '.cs', '.sql', '.toml', '.ini', '.xml', '.mjs', '.cjs', '.jsx', '.vue', '.svelte', '.lock', '.log', '.conf', '.mdx']);

// The CLI's own state and the Deck's: never served, even when the session cwd is $HOME.
const DENIED_SEGMENTS = new Set(['.claude', '.cockpit']);

export function isDeniedSessionPath(path: string): boolean {
  if (isSensitivePath(path)) return true;
  const segs = path.replace(/\\/g, '/').split('/');
  return segs.some((s) => DENIED_SEGMENTS.has(s) || s === '.claude.json');
}

function sessionMime(path: string): string {
  const m = mimeOf(path);
  return m === 'application/octet-stream' && TEXT_EXT.has(extname(path).toLowerCase()) ? 'text/plain' : m;
}

// The JSONL's first record that carries a cwd is where the CLI ran. Falls back
// to the Deck workdir; a cwd that is not a directory is ignored.
export async function sessionCwd(sessionId: string): Promise<string | null> {
  if (!SESSION_ID.test(sessionId)) return null;
  const file = join(CONFIG.projectsDir, `${sessionId}.jsonl`);
  let fh;
  try { fh = await open(file, 'r'); } catch { return null; }
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await fh.read(buf, 0, HEAD_BYTES, 0);
    for (const line of buf.subarray(0, bytesRead).toString('utf8').split('\n')) {
      const m = /"cwd":("(?:[^"\\]|\\.)*")/.exec(line);
      if (!m) continue;
      try {
        const cwd = JSON.parse(m[1]) as string;
        if (isAbsolute(cwd) && (await stat(cwd)).isDirectory()) return cwd;
      } catch { /* try the next record */ }
    }
  } finally { await fh.close(); }
  return CONFIG.workdir;
}

export type SessionFileRead = { mime: string; size: number; dataB64: string } | { error: string };

// The path comes from the browser: untrusted. It is resolved against the session
// cwd, every symlink is followed, and the REAL path must still sit inside the
// REAL cwd and not be a sensitive file.
export async function readSessionFile(sessionId: unknown, rel: unknown): Promise<SessionFileRead> {
  if (typeof sessionId !== 'string') return { error: 'sessão inválida' };
  if (typeof rel !== 'string' || !rel || rel.length > MAX_PATH || rel.includes('\0')) return { error: 'caminho inválido' };
  if (rel.split(/[\\/]/).some((seg) => seg === '..')) return { error: 'caminho inválido' };
  const cwd = await sessionCwd(sessionId);
  if (!cwd) return { error: 'sessão não encontrada' };
  try {
    const root = await realpath(cwd);
    const target = resolve(root, rel);
    if (isDeniedSessionPath(target)) return { error: 'arquivo sensível' };
    const real = await realpath(target);
    if (real !== root && !real.startsWith(root + sep)) return { error: 'caminho fora da sessão' };
    if (isDeniedSessionPath(real)) return { error: 'arquivo sensível' };
    const st = await stat(real);
    if (!st.isFile()) return { error: 'não é um arquivo' };
    if (st.size > MAX_BOT_FILE_BYTES) return { error: 'arquivo passa de 10MB' };
    let buf = await readFile(real);
    if (buf.length > MAX_BOT_FILE_BYTES) return { error: 'arquivo passa de 10MB' };
    const mime = sessionMime(real);
    if (mime.startsWith('text/') || mime === 'application/json') buf = Buffer.from(redactSecrets(buf.toString('utf8')), 'utf8');
    return { mime, size: buf.length, dataB64: buf.toString('base64') };
  } catch {
    return { error: 'arquivo não encontrado' };
  }
}
