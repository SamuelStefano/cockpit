import { describe, it, expect } from 'vitest';
import { safeHref } from './safe-href';

describe('safeHref', () => {
  it('deixa passar http(s) e mailto', () => {
    expect(safeHref('https://github.com/x/y/pull/1')).toBe('https://github.com/x/y/pull/1');
    expect(safeHref('http://a.b')).toBe('http://a.b');
    expect(safeHref('mailto:a@b.c')).toBe('mailto:a@b.c');
  });

  it('deixa passar caminho relativo', () => {
    expect(safeHref('/docs')).toBe('/docs');
    expect(safeHref('#topo')).toBe('#topo');
    expect(safeHref('pasta/arquivo.md')).toBe('pasta/arquivo.md');
  });

  it('bloqueia esquema executável', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('  JavaScript:alert(1)')).toBeUndefined();
    expect(safeHref('data:text/html,<script>')).toBeUndefined();
    expect(safeHref('vbscript:x')).toBeUndefined();
  });
});
