import { describe, expect, it } from 'vitest';
import { looksLikePath, toolPath } from './looks-like-path';

describe('looksLikePath', () => {
  it('accepts relative and absolute file paths', () => {
    for (const s of ['src/hooks/x.ts', '/home/a/b.md', 'README.md', './a/b.json', 'package.json', '.env.local']) expect(looksLikePath(s)).toBe(true);
  });
  it('rejects prose, urls, commands and bare words', () => {
    for (const s of ['npm run build', 'https://a.com/x.ts', 'useState', 'src/hooks', 'a|b.ts', 'v1.2', '']) expect(looksLikePath(s)).toBe(false);
  });
  it('toolPath only takes a lone path', () => {
    expect(toolPath('  src/a.ts ')).toBe('src/a.ts');
    expect(toolPath('src/a.ts --flag')).toBeNull();
  });
});
