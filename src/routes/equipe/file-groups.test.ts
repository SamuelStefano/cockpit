import { describe, it, expect } from 'vitest';
import { fileKind, formatSize, groupFilesByAge } from './file-groups';

describe('groupFilesByAge', () => {
  it('splits Hoje / Esta semana / Antes, newest first, dropping empty groups', () => {
    const now = new Date(2026, 9, 25, 15, 0).getTime();
    const at = (d: number, h = 10) => new Date(2026, 9, d, h).getTime();
    const files = [
      { path: 'velho.md', size: 1, mtime: at(1) },
      { path: 'cedo.png', size: 1, mtime: at(25, 1) },
      { path: 'tarde.png', size: 1, mtime: at(25, 14) },
      { path: 'semana.txt', size: 1, mtime: at(20) },
      { path: 'ontem.md', size: 1, mtime: at(24, 23) },
    ];
    expect(groupFilesByAge(files, now).map((g) => [g.label, g.items.map((f) => f.path)])).toEqual([
      ['Hoje', ['tarde.png', 'cedo.png']],
      ['Esta semana', ['ontem.md', 'semana.txt']],
      ['Antes', ['velho.md']],
    ]);
    expect(groupFilesByAge([files[0]], now).map((g) => g.label)).toEqual(['Antes']);
  });

  it('tells the preview kind and formats sizes', () => {
    expect([fileKind('a/b.PNG'), fileKind('n.md'), fileKind('d.json'), fileKind('x.pdf')]).toEqual(['image', 'markdown', 'text', 'other']);
    expect([formatSize(900), formatSize(2048), formatSize(3 * 1024 * 1024)]).toEqual(['900 B', '2 KB', '3.0 MB']);
  });
});
