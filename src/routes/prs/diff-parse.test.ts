import { describe, expect, it } from 'vitest';
import type { PrDiffFile, PrReviewThread } from '../../../shared/prs';
import { filterFiles, isGenerated, langOf, markChanges, parsePatch, splitAtRange, splitPath, startsCollapsed, threadsForFile } from './diff-parse';

const PATCH = [
  '@@ -10,4 +10,5 @@ export function run() {',
  ' const a = 1;',
  '-const b = 2;',
  '+const b = 3;',
  '+const c = 4;',
  ' return a;',
  '\\ No newline at end of file',
  '@@ -40 +41 @@',
  '-old',
  '+new',
].join('\n');

const file = (over: Partial<PrDiffFile> = {}): PrDiffFile => ({ path: 'src/a.ts', change: 'modified', additions: 1, deletions: 1, ...over });

describe('parsePatch', () => {
  it('numbers each side and keeps the hunk context', () => {
    const rows = parsePatch(PATCH);
    expect(rows.map((r) => r.t)).toEqual(['hunk', 'ctx', 'del', 'add', 'add', 'ctx', 'hunk', 'del', 'add']);
    expect(rows[0].text).toBe('export function run() {');
    expect(rows[1]).toMatchObject({ oldLn: 10, newLn: 10, text: 'const a = 1;' });
    expect(rows[2]).toMatchObject({ oldLn: 11, newLn: 0 });
    expect(rows[3]).toMatchObject({ oldLn: 0, newLn: 11 });
    expect(rows[4]).toMatchObject({ oldLn: 0, newLn: 12 });
    expect(rows[5]).toMatchObject({ oldLn: 12, newLn: 13 });
    expect(rows[7]).toMatchObject({ oldLn: 40, newLn: 0 });
    expect(rows[8]).toMatchObject({ oldLn: 0, newLn: 41 });
  });

  it('keeps an empty context line and drops the no-newline marker', () => {
    const rows = parsePatch('@@ -1,2 +1,2 @@\n \n-a\n+b');
    expect(rows[1]).toMatchObject({ t: 'ctx', text: '', oldLn: 1, newLn: 1 });
    expect(parsePatch(PATCH).some((r) => r.text.includes('No newline'))).toBe(false);
  });

  it('ignores anything before the first hunk', () => {
    expect(parsePatch('garbage\n@@ -1 +1 @@\n+x').map((r) => r.t)).toEqual(['hunk', 'add']);
  });
});

describe('langOf', () => {
  it('maps extensions and Dockerfiles', () => {
    expect(langOf('src/App.tsx')).toBe('tsx');
    expect(langOf('server/x.mts')).toBe('typescript');
    expect(langOf('deploy/Dockerfile.web')).toBe('docker');
    expect(langOf('LICENSE')).toBe('');
    expect(langOf('a/b.unknown')).toBe('');
  });
});

describe('startsCollapsed', () => {
  it('folds lockfiles, deletions and long diffs', () => {
    expect(isGenerated('package-lock.json')).toBe(true);
    expect(isGenerated('apps/web/dist/index.js')).toBe(true);
    expect(isGenerated('src/distance.ts')).toBe(false);
    expect(startsCollapsed(file({ path: 'pnpm-lock.yaml' }), 3)).toBe(true);
    expect(startsCollapsed(file({ change: 'deleted' }), 3)).toBe(true);
    expect(startsCollapsed(file(), 401)).toBe(true);
    expect(startsCollapsed(file(), 400)).toBe(false);
  });
});

describe('splitPath / filterFiles', () => {
  it('splits the directory from the name', () => {
    expect(splitPath('src/routes/prs/Prs.tsx')).toEqual({ dir: 'src/routes/prs/', name: 'Prs.tsx' });
    expect(splitPath('README.md')).toEqual({ dir: '', name: 'README.md' });
  });

  it('filters by a case-insensitive substring of the path', () => {
    const files = [file({ path: 'src/A.ts' }), file({ path: 'server/b.ts' })];
    expect(filterFiles(files, ' SRC ').map((f) => f.path)).toEqual(['src/A.ts']);
    expect(filterFiles(files, '')).toHaveLength(2);
  });
});

describe('threadsForFile', () => {
  const thread = (over: Partial<PrReviewThread>): PrReviewThread => ({ path: 'src/a.ts', resolved: false, outdated: false, comments: [{ author: 'x', body: 'y', createdAt: '' }], ...over });

  it('anchors a thread to its line only when the patch shows that line', () => {
    const rows = parsePatch(PATCH);
    const out = threadsForFile([thread({ line: 11 }), thread({ line: 999 }), thread({}), thread({ path: 'other.ts', line: 11 })], 'src/a.ts', rows);
    expect([...out.byNew.keys()]).toEqual([11]);
    expect(out.loose).toHaveLength(2);
    expect(out.count).toBe(3);
  });

  it('a comment on a removed line anchors on the old side', () => {
    const rows = parsePatch(PATCH);
    const out = threadsForFile([thread({ line: 40, side: 'left' }), thread({ line: 41, side: 'left' })], 'src/a.ts', rows);
    expect([...out.byOld.keys()]).toEqual([40]);
    expect(out.byNew.size).toBe(0);
    expect(out.loose).toHaveLength(1);
  });
});

describe('markChanges / splitAtRange', () => {
  it('marks only the differing middle of a paired edit', () => {
    const rows = parsePatch('@@ -1,2 +1,2 @@\n-const b = 2;\n-keep me\n+const b = 30;\n+keep me');
    const marks = markChanges(rows);
    expect(marks.get(1)).toEqual([10, 11]);
    expect(marks.get(3)).toEqual([10, 12]);
    expect(marks.has(2)).toBe(false);
    expect(marks.has(4)).toBe(false);
  });

  it('leaves unpaired runs and rewritten lines alone', () => {
    expect(markChanges(parsePatch('@@ -1,2 +1 @@\n-a = 1\n-b = 2\n+a = 3')).size).toBe(0);
    expect(markChanges(parsePatch('@@ -1 +1 @@\n-x completely different\n-\n+x other words entirely here\n+')).size).toBe(0);
  });

  it('cuts tokens at the range edges', () => {
    const pieces = splitAtRange([{ content: 'const ', color: 'a' }, { content: 'value', color: 'b' }], [4, 8]);
    expect(pieces.map((p) => [p.content, p.mark])).toEqual([['cons', false], ['t ', true], ['va', true], ['lue', false]]);
    expect(splitAtRange([{ content: 'abc' }], undefined)).toEqual([{ content: 'abc', color: undefined, italic: false, mark: false }]);
  });
});
