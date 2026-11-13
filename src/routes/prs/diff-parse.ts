import type { PrDiffFile, PrReviewThread } from '../../../shared/prs';

export type DiffRowKind = 'hunk' | 'ctx' | 'add' | 'del';
// `oldLn`/`newLn` are 0 on the side a row does not exist on (and on hunk headers).
export interface DiffRow { t: DiffRowKind; text: string; oldLn: number; newLn: number }

const HUNK_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@ ?(.*)$/;

// GitHub's per-file `patch`: hunks only, no `diff --git` header.
export function parsePatch(patch: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let oldLn = 0;
  let newLn = 0;
  for (const line of patch.split('\n')) {
    const h = HUNK_RE.exec(line);
    if (h) {
      oldLn = Number(h[1]);
      newLn = Number(h[2]);
      rows.push({ t: 'hunk', text: h[3] ?? '', oldLn: 0, newLn: 0 });
      continue;
    }
    // "\ No newline at end of file" is a marker, not a line of either side.
    if (line.startsWith('\\')) continue;
    const text = line.slice(1);
    if (line.startsWith('+')) rows.push({ t: 'add', text, oldLn: 0, newLn: newLn++ });
    else if (line.startsWith('-')) rows.push({ t: 'del', text, oldLn: oldLn++, newLn: 0 });
    else if (rows.length) rows.push({ t: 'ctx', text, oldLn: oldLn++, newLn: newLn++ });
  }
  return rows;
}

const LANG: Record<string, string> = {
  ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'tsx', js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx',
  json: 'json', jsonc: 'jsonc', sh: 'bash', bash: 'bash', zsh: 'bash', py: 'python', sql: 'sql', html: 'html', css: 'css',
  md: 'markdown', mdx: 'markdown', yml: 'yaml', yaml: 'yaml', toml: 'toml', ini: 'ini', go: 'go', rs: 'rust', xml: 'xml', svg: 'xml',
};

export function langOf(path: string): string {
  const name = path.split('/').pop() ?? path;
  if (/^Dockerfile/i.test(name)) return 'docker';
  return LANG[name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''] ?? '';
}

const GENERATED_RE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|go\.sum|composer\.lock|Gemfile\.lock)$|\.(min\.(js|css)|snap|map)$|(^|\/)(dist|build|vendor)\//;

export const isGenerated = (path: string): boolean => GENERATED_RE.test(path);

export const BIG_FILE_ROWS = 400;

// What starts folded: lockfiles and build output nobody reviews, deletions (the
// code is gone), and diffs long enough to bury the files after them.
export function startsCollapsed(file: PrDiffFile, rowCount: number): boolean {
  return isGenerated(file.path) || file.change === 'deleted' || rowCount > BIG_FILE_ROWS;
}

export function splitPath(path: string): { dir: string; name: string } {
  const i = path.lastIndexOf('/');
  return i === -1 ? { dir: '', name: path } : { dir: path.slice(0, i + 1), name: path.slice(i + 1) };
}

export function filterFiles(files: PrDiffFile[], query: string): PrDiffFile[] {
  const q = query.trim().toLowerCase();
  return q ? files.filter((f) => f.path.toLowerCase().includes(q)) : files;
}

export interface FileThreads { byLine: Map<number, PrReviewThread[]>; loose: PrReviewThread[] }

// Threads anchored to a head-side line that the patch shows go under that row; the
// rest (outdated, file-level, line outside every hunk) sit on top of the file.
export function threadsForFile(threads: PrReviewThread[], path: string, rows: DiffRow[]): FileThreads {
  const shown = new Set(rows.filter((r) => r.newLn > 0).map((r) => r.newLn));
  const byLine = new Map<number, PrReviewThread[]>();
  const loose: PrReviewThread[] = [];
  for (const t of threads) {
    if (t.path !== path) continue;
    if (t.line && shown.has(t.line)) byLine.set(t.line, [...(byLine.get(t.line) ?? []), t]);
    else loose.push(t);
  }
  return { byLine, loose };
}

// Stable DOM id for jump-to-file; paths carry characters an id selector chokes on.
export const fileAnchor = (path: string): string => `prf-${path.replace(/[^\w-]/g, '_')}`;

export type CharRange = [start: number, end: number];

const PAIR_RUN_MAX = 40;
// Past this share of the line, "what changed" is the whole line: marking it only adds noise.
const CHANGED_SHARE_MAX = 0.7;

function changedRanges(a: string, b: string): [CharRange, CharRange] | null {
  let pre = 0;
  const max = Math.min(a.length, b.length);
  while (pre < max && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < max - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const da = a.length - pre - suf;
  const db = b.length - pre - suf;
  if (!pre && !suf) return null;
  if (Math.max(da, db) > Math.max(a.length, b.length) * CHANGED_SHARE_MAX) return null;
  return [[pre, pre + da], [pre, pre + db]];
}

// A run of N removed lines followed by N added ones is N edited lines: the part of
// each that differs gets a stronger mark, so a one-word edit reads at a glance.
export function markChanges(rows: DiffRow[]): Map<number, CharRange> {
  const out = new Map<number, CharRange>();
  let i = 0;
  while (i < rows.length) {
    if (rows[i].t !== 'del') { i++; continue; }
    let d = i;
    while (d < rows.length && rows[d].t === 'del') d++;
    let a = d;
    while (a < rows.length && rows[a].t === 'add') a++;
    const dels = d - i;
    if (dels === a - d && dels <= PAIR_RUN_MAX) {
      for (let k = 0; k < dels; k++) {
        const r = changedRanges(rows[i + k].text, rows[d + k].text);
        if (!r) continue;
        if (r[0][1] > r[0][0]) out.set(i + k, r[0]);
        if (r[1][1] > r[1][0]) out.set(d + k, r[1]);
      }
    }
    i = a;
  }
  return out;
}

export interface Piece { content: string; color?: string; italic?: boolean; mark: boolean }

// Cuts highlighter tokens at the range edges so the mark can wrap exact characters.
export function splitAtRange(tokens: { content: string; color?: string; fontStyle?: number }[], range: CharRange | undefined): Piece[] {
  const out: Piece[] = [];
  let pos = 0;
  for (const t of tokens) {
    const base = { color: t.color, italic: !!(t.fontStyle && t.fontStyle & 1) };
    const end = pos + t.content.length;
    if (!range || end <= range[0] || pos >= range[1]) out.push({ ...base, content: t.content, mark: false });
    else {
      const a = Math.max(range[0] - pos, 0);
      const b = Math.min(range[1] - pos, t.content.length);
      if (a > 0) out.push({ ...base, content: t.content.slice(0, a), mark: false });
      out.push({ ...base, content: t.content.slice(a, b), mark: true });
      if (b < t.content.length) out.push({ ...base, content: t.content.slice(b), mark: false });
    }
    pos = end;
  }
  return out;
}

// GitHub anchors a file inside "Files changed" by the SHA-256 of its path.
export async function githubFileUrl(prUrl: string, path: string): Promise<string> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(path));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${prUrl}/files#diff-${hex}`;
  } catch {
    return `${prUrl}/files`;
  }
}
