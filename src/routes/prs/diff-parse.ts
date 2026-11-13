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
