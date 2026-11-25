import { isUtf8 } from 'node:buffer';
import { constants, createReadStream } from 'node:fs';
import { open, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, extname, isAbsolute, join, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { CONFIG, projectSlug } from './config';
import { isSensitivePath, redactSecrets } from './redact-secrets';
import { MAX_BOT_FILE_BYTES, mimeOf } from './team-files';

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_PATH = 1024;
// The first record with a cwd can sit behind a first prompt with pasted images.
const CWD_SCAN_BYTES = 16 * 1024 * 1024;
const TAIL_BYTES = 256 * 1024;
// Text is rendered one DOM row per line: past this the panel shows a cut file.
export const MAX_SESSION_TEXT_BYTES = 512 * 1024;
const MAX_CONCURRENT_READS = 3;

// Hidden directories hold CLI state, tokens and credentials (~/.claude, ~/.config/gh,
// ~/.dfl-mcp, ~/.aws...) and the cwd is often $HOME: deny every hidden directory
// except the few that are plain project files.
const ALLOWED_HIDDEN_DIRS = new Set(['.github', '.vscode', '.devcontainer', '.husky', '.storybook']);

const SECRET_FILE = /^(\.claude\.json|\.(npmrc|yarnrc|pypirc|git-credentials|netrc|pgpass|my\.cnf|htpasswd|dockercfg|bash_history|zsh_history|python_history|node_repl_history|psql_history|mysql_history)|kubeconfig|wallet\.dat|secrets?\.(json|ya?ml|toml|txt|ini|properties|conf)|service[-_]?account.*\.json)$/;
const SECRET_EXT = /\.(tfvars|tfstate|kdbx|jks|keystore|ovpn|asc|gpg|ppk|der|crt\.key)(\.backup|\.bak)?$/;

// Case-folded and NFC so a case-insensitive disk (macOS, Windows) cannot serve
// `.ENV` or `.SSH/`; Windows also ignores trailing dots/spaces and `:stream`.
export function isDeniedSessionPath(path: string, home = process.env.HOME ?? ''): boolean {
  const fold = (s: string) => s.normalize('NFC').toLowerCase().replace(/\\/g, '/');
  const segs = fold(path).split('/').filter(Boolean).map((s, i) => (i === 0 && /^[a-z]:$/.test(s) ? s : s.replace(/:.*$/, '').replace(/[. ]+$/, '')));
  const p = `${path.startsWith('/') || path.startsWith('\\') ? '/' : ''}${segs.join('/')}`;
  if (isSensitivePath(p, fold(home))) return true;
  const dirs = segs.slice(0, -1);
  const file = segs[segs.length - 1] ?? '';
  if (dirs.some((s) => s.startsWith('.') && !ALLOWED_HIDDEN_DIRS.has(s))) return true;
  // isSensitivePath misses `.env.production.local`, `.envrc`, `prod.env.bak`.
  if (file.startsWith('.env') || file.includes('.env.')) return true;
  return SECRET_FILE.test(file) || SECRET_EXT.test(file);
}

const topLevelCwd = (line: string): string | null => {
  try {
    const cwd = (JSON.parse(line) as { cwd?: unknown } | null)?.cwd;
    return typeof cwd === 'string' && isAbsolute(cwd) ? cwd : null;
  } catch { return null; }
};

const cwdCache = new Map<string, string>();

// Where the CLI was started: the TOP-LEVEL `cwd` of the first record that has one.
// Records are parsed, never regex-scanned: a tool input or attachment can carry a
// nested `"cwd":"/"` ahead of the real field. The CLI files a session under the
// slug of its start cwd, so a cwd that does not slug to this projects dir is not
// trusted either. No fallback: a session without a cwd serves no files.
export async function sessionCwd(sessionId: string): Promise<string | null> {
  if (!SESSION_ID.test(sessionId)) return null;
  const hit = cwdCache.get(sessionId);
  if (hit) return hit;
  const stream = createReadStream(join(CONFIG.projectsDir, `${sessionId}.jsonl`), { encoding: 'utf8', end: CWD_SCAN_BYTES - 1 });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      const cwd = topLevelCwd(line);
      if (!cwd) continue;
      if (projectSlug(cwd) !== basename(CONFIG.projectsDir)) return null;
      if (!(await stat(cwd)).isDirectory()) return null;
      if (cwdCache.size > 500) cwdCache.clear();
      cwdCache.set(sessionId, cwd);
      return cwd;
    }
  } catch { /* unreadable session */ } finally { lines.close(); stream.destroy(); }
  return null;
}

// Where the CLI is NOW (it follows `cd`): only a base for relative paths. The
// result is still contained in the start cwd, so this value needs no trust.
async function sessionLastCwd(sessionId: string): Promise<string | null> {
  let fh;
  try { fh = await open(join(CONFIG.projectsDir, `${sessionId}.jsonl`), 'r'); } catch { return null; }
  try {
    const { size } = await fh.stat();
    const len = Math.min(size, TAIL_BYTES);
    const buf = Buffer.alloc(len);
    const { bytesRead } = await fh.read(buf, 0, len, size - len);
    const lines = buf.subarray(0, bytesRead).toString('utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const cwd = topLevelCwd(lines[i]);
      if (cwd) return cwd;
    }
  } catch { /* fall back to the start cwd */ } finally { await fh.close(); }
  return null;
}

export type SessionFileRead = { mime: string; size: number; dataB64: string; truncated?: boolean } | { error: string };

const inside = (root: string, p: string) => p === root || p.startsWith(root.endsWith(sep) ? root : root + sep);

const NOT_FOUND = { error: 'arquivo não encontrado' };

let reading = 0;

// The path comes from the browser: untrusted. It is resolved against the session
// cwd, every symlink is followed, and the REAL path must still sit inside the
// REAL cwd and not be a sensitive file.
export async function readSessionFile(sessionId: unknown, rel: unknown): Promise<SessionFileRead> {
  if (typeof sessionId !== 'string') return { error: 'sessão inválida' };
  if (typeof rel !== 'string' || !rel || rel.length > MAX_PATH || rel.includes('\0')) return { error: 'caminho inválido' };
  if (rel.split(/[\\/]/).some((seg) => seg === '..')) return { error: 'caminho inválido' };
  if (reading >= MAX_CONCURRENT_READS) return { error: 'muitas leituras ao mesmo tempo, tente de novo' };
  reading++;
  try {
    const cwd = await sessionCwd(sessionId);
    if (!cwd) return { error: 'sessão não encontrada' };
    const root = await realpath(cwd);
    const path = rel === '~' || rel.startsWith('~/') ? join(homedir(), rel.slice(1)) : rel;
    const bases = [root];
    if (!isAbsolute(path)) {
      const last = await sessionLastCwd(sessionId);
      const lastReal = last && last !== cwd ? await realpath(last).catch(() => null) : null;
      if (lastReal && inside(root, lastReal)) bases.unshift(lastReal);
    }
    let out: SessionFileRead = NOT_FOUND;
    for (const base of bases) {
      const target = resolve(base, path);
      // Decided on the string alone: an outside path must not probe the disk.
      if (!inside(root, target)) return { error: 'caminho fora da sessão' };
      if (isDeniedSessionPath(target)) return { error: 'arquivo sensível' };
      out = await readContained(root, target);
      if (out !== NOT_FOUND) return out;
    }
    return out;
  } catch {
    return NOT_FOUND;
  } finally { reading--; }
}

// A symlink that leaves the cwd answers like a missing file: the error must not
// tell whether its target exists.
async function readContained(root: string, target: string): Promise<SessionFileRead> {
  let real: string;
  try { real = await realpath(target); } catch { return NOT_FOUND; }
  if (!inside(root, real)) return NOT_FOUND;
  if (isDeniedSessionPath(real)) return { error: 'arquivo sensível' };
  let fh;
  // NOFOLLOW + NONBLOCK: a file swapped for a symlink or a FIFO after realpath
  // fails or returns at once instead of escaping or hanging the read.
  try { fh = await open(real, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0)); } catch { return NOT_FOUND; }
  try {
    const st = await fh.stat();
    if (st.isDirectory()) return { error: 'não é um arquivo' };
    if (!st.isFile()) return NOT_FOUND;
    if (st.size > MAX_BOT_FILE_BYTES) return { error: 'arquivo passa de 10MB' };
    // The descriptor is what gets read: confirm IT still lives inside the cwd, in
    // case a parent directory was swapped between realpath and open.
    if (!(await sameFileInside(root, real, st))) return NOT_FOUND;
    const known = mimeOf(real);
    const image = known.startsWith('image/');
    // Bounded by what was allocated: a file growing mid-read cannot pass the cap.
    const cap = Math.min(st.size, image ? MAX_BOT_FILE_BYTES : MAX_SESSION_TEXT_BYTES + 4);
    const buf = Buffer.alloc(cap);
    let got = 0;
    while (got < cap) {
      const { bytesRead } = await fh.read(buf, got, cap - got, got);
      if (!bytesRead) break;
      got += bytesRead;
    }
    const data = buf.subarray(0, got);
    // SVG is text (it can embed anything) but renders as an image: redact it too.
    if (image && known !== 'image/svg+xml') return { mime: known, size: got, dataB64: data.toString('base64') };
    // Everything else leaves the box only as redacted text. Bytes that are not
    // text (pdf, archives, sqlite, unknown binaries) have no preview and are not sent.
    if (data.includes(0)) return { error: 'sem prévia pra este tipo de arquivo' };
    const truncated = st.size > MAX_SESSION_TEXT_BYTES;
    let text = data.subarray(0, Math.min(got, MAX_SESSION_TEXT_BYTES)).toString('utf8');
    // Strict decode, not a search for U+FFFD: a text file may contain that character.
    if (!truncated && !isUtf8(data)) return { error: 'sem prévia pra este tipo de arquivo' };
    if (truncated) text = text.slice(0, Math.max(text.lastIndexOf('\n') + 1, 1));
    const red = Buffer.from(redactSecrets(text), 'utf8');
    const mime = image || known === 'text/markdown' || known === 'application/json' || known.startsWith('text/') ? known : 'text/plain';
    return { mime, size: st.size, dataB64: red.toString('base64'), ...(truncated ? { truncated } : {}) };
  } finally { await fh.close(); }
}

async function sameFileInside(root: string, real: string, st: { dev: number; ino: number }): Promise<boolean> {
  try {
    const again = await realpath(real);
    if (again !== real || !inside(root, again)) return false;
    const now = await stat(again);
    return now.dev === st.dev && now.ino === st.ino;
  } catch { return false; }
}
