import { describe, expect, it } from 'vitest';
import { looksLikePath, parsePathRef, toolPath } from './looks-like-path';

describe('parsePathRef', () => {
  it('accepts relative and absolute file paths', () => {
    for (const s of ['src/hooks/x.ts', '/home/a/b.md', 'README.md', './a/b.json', 'package.json', '~/wt/a/b.tsx', 'app/(shop)/[id]/page.tsx', 'server/Dockerfile', 'Makefile', '.gitignore', 'src/.eslintrc', 'logs/out.log', 'a/b.d.ts']) expect(looksLikePath(s), s).toBe(true);
  });
  it('rejects prose, urls, commands and bare words', () => {
    for (const s of ['npm run build', 'https://a.com/x.ts', 'useState', 'src/hooks', 'a|b.ts', 'v1.2', '', '../a/b.ts', 'a/../b.ts', 'key=a/b.ts', 'C:\\a\\b.ts']) expect(looksLikePath(s), s).toBe(false);
  });
  it('rejects member accesses and library names that look like files', () => {
    for (const s of ['console.log', 'user.name', 'Math.max', 'process.env', '.map', '.then', '.length', 'Node.js', 'Next.js', 'res.json', 'e.target', 'foo.bar', 'arr.at', '1.5x', 'example.com']) expect(looksLikePath(s), s).toBe(false);
  });
  it('splits the line the CLI appends', () => {
    expect(parsePathRef('src/a.ts:42')).toEqual({ path: 'src/a.ts', line: 42 });
    expect(parsePathRef('src/a.ts:42:7')).toEqual({ path: 'src/a.ts', line: 42 });
    expect(parsePathRef('src/a.ts:10-20')).toEqual({ path: 'src/a.ts', line: 10 });
    expect(parsePathRef('a.ts#L9')).toEqual({ path: 'a.ts', line: 9 });
    expect(parsePathRef('a.ts#L9-L12')).toEqual({ path: 'a.ts', line: 9 });
    expect(parsePathRef('src/a.ts')).toEqual({ path: 'src/a.ts' });
    expect(parsePathRef('localhost:3000')).toBeNull();
    expect(parsePathRef('src/a.ts:')).toBeNull();
  });
  it('toolPath takes the whole command of a file tool, one line only', () => {
    expect(toolPath('  src/a.ts ')).toBe('src/a.ts');
    expect(toolPath('/home/a/My Notes/Dockerfile')).toBe('/home/a/My Notes/Dockerfile');
    expect(toolPath('a\nb')).toBeNull();
    expect(toolPath('a/../b')).toBeNull();
    expect(toolPath('')).toBeNull();
  });
});
