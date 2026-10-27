export type ImportKind = 'skills' | 'mcps' | 'memory';
export const IMPORT_KINDS: readonly ImportKind[] = ['skills', 'mcps', 'memory'];

export interface ImportSkillItem { name: string; exists: boolean }
export interface ImportMcpItem { name: string; exists: boolean; needsFill: string[] }
export interface ImportMemoryItem { label: string; files: number; bytes: number; exists: boolean }

export interface ClaudeImportScan {
  source: string;
  found: boolean;
  reason?: 'unreadable' | 'not-found' | 'invalid' | 'same-as-target';
  skills: ImportSkillItem[];
  mcps: ImportMcpItem[];
  memory: ImportMemoryItem[];
}

export interface ClaudeImportResult {
  copied: Record<ImportKind, string[]>;
  skipped: string[];
  needsFill: Array<{ mcp: string; keys: string[] }>;
  errors: string[];
}

const SECRET_KEY_RE = /(key|token|secret|passw|auth|credential|bearer|cookie|session)/i;
const SECRET_VALUE_RE = /^(sk-|sk_|ghp_|gho_|github_pat_|xox[abp]-|AIza|eyJ|AKIA|glpat-|npm_)|^[A-Za-z0-9+/=_-]{32,}$/;

export function looksSecret(key: string, value: string): boolean {
  if (/^\$\{?[A-Z0-9_]+\}?$/.test(value)) return false;
  return SECRET_KEY_RE.test(key) || SECRET_VALUE_RE.test(value);
}

function stripMap(map: unknown, label: string, needsFill: string[]): Record<string, string> | undefined {
  if (!map || typeof map !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map as Record<string, unknown>)) {
    if (typeof v !== 'string') continue;
    if (looksSecret(k, v)) { out[k] = ''; needsFill.push(`${label}${k}`); } else out[k] = v;
  }
  return out;
}

function stripUrl(url: string, needsFill: string[]): string {
  try {
    const u = new URL(url);
    if (u.username || u.password) { u.username = ''; u.password = ''; needsFill.push('url:credenciais'); }
    for (const [k, v] of [...u.searchParams]) {
      if (looksSecret(k, v)) { u.searchParams.delete(k); needsFill.push(`url:${k}`); }
    }
    return u.toString();
  } catch {
    return url;
  }
}

function stripArgs(args: unknown[], needsFill: string[]): unknown[] {
  const out: unknown[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (typeof a !== 'string') { out.push(a); continue; }
    const eq = a.match(/^(--?[\w-]+)=(.+)$/);
    if (eq && looksSecret(eq[1], eq[2])) { out.push(`${eq[1]}=`); needsFill.push(`arg:${eq[1]}`); continue; }
    if (/^--?[\w-]+$/.test(a) && SECRET_KEY_RE.test(a) && typeof args[i + 1] === 'string') {
      out.push(a, ''); needsFill.push(`arg:${a}`); i++; continue;
    }
    if (SECRET_VALUE_RE.test(a) && !a.includes('/') && !a.includes('@') && /\d/.test(a) && /[A-Za-z]/.test(a) && a.length >= 32) { out.push(''); needsFill.push('arg:valor'); continue; }
    out.push(a);
  }
  return out;
}

// Copies an MCP server definition without anything that looks like a credential;
// the stripped keys come back so the UI can tell the user what to fill in.
export function sanitizeMcp(server: unknown): { server: Record<string, unknown>; needsFill: string[] } | null {
  if (!server || typeof server !== 'object' || Array.isArray(server)) return null;
  const s = server as Record<string, unknown>;
  const needsFill: string[] = [];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'env') { const e = stripMap(v, '', needsFill); if (e) out.env = e; }
    else if (k === 'headers') { const h = stripMap(v, 'header:', needsFill); if (h) out.headers = h; }
    else if (k === 'url' && typeof v === 'string') out.url = stripUrl(v, needsFill);
    else if (k === 'args' && Array.isArray(v)) out.args = stripArgs(v, needsFill);
    else if (typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number') out[k] = v;
  }
  if (typeof out.command !== 'string' && typeof out.url !== 'string') return null;
  return { server: out, needsFill };
}

export const STAGING_DIR = '$HOME/claude-import';

// For a source the Deck user cannot read (another user's home): the one command
// that stages a readable copy.
export function copyHintCommand(sourceDir: string): string {
  const dir = sourceDir.replace(/\/+$/, '');
  const home = dir.replace(/\/\.claude$/, '');
  const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
  return `mkdir -p "${STAGING_DIR}" && for f in .claude .claude.json .claude-mem; do sudo cp -r ${q(home)}/$f "${STAGING_DIR}/" 2>/dev/null; done; sudo chown -R "$(id -un)" "${STAGING_DIR}"`;
}
