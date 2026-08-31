import { describe, it, expect } from 'vitest';
import { parseFrontmatter, unquote, stripFrontmatter } from './frontmatter';

describe('parseFrontmatter', () => {
  it('parses name/description/type and keeps a colon inside a quoted value', () => {
    const fm = parseFrontmatter('---\nname: x\ndescription: "a: b"\ntype: memory\n---\nbody');
    expect(fm).toEqual({ name: 'x', description: 'a: b', type: 'memory' });
  });

  // Nos arquivos de memory reais o `type` vem ANINHADO sob `metadata:`, junto de
  // outras chaves. O regex tolera indentação de propósito — não "consertar" pra só
  // top-level, ou todo contexto de memória passa a ser lido sem tipo.
  it('tolerates indentation (nested keys under a parent)', () => {
    const fm = parseFrontmatter('---\nname: roadmap\ndescription: "x"\nmetadata: \n  node_type: memory\n  type: project\n  originSessionId: abc\n---\nbody');
    expect(fm.name).toBe('roadmap');
    expect(fm.type).toBe('project');
  });

  it('keeps the first value when a key repeats', () => {
    const fm = parseFrontmatter('---\nname: first\nname: second\n---\n');
    expect(fm.name).toBe('first');
  });

  it('returns empty when there is no frontmatter fence', () => {
    expect(parseFrontmatter('no fence here')).toEqual({});
  });

  it('parses an unterminated block to end of text', () => {
    expect(parseFrontmatter('---\nname: x\n')).toEqual({ name: 'x' });
  });
});

describe('unquote', () => {
  it('strips matching single or double quotes', () => {
    expect(unquote("'x'")).toBe('x');
    expect(unquote('"x"')).toBe('x');
  });

  it('leaves unbalanced or unquoted strings untouched', () => {
    expect(unquote('"x')).toBe('"x');
    expect(unquote('x')).toBe('x');
  });
});

describe('stripFrontmatter', () => {
  it('removes the fenced block and leading whitespace', () => {
    expect(stripFrontmatter('---\nname: x\n---\n\nbody text')).toBe('body text');
  });

  it('returns raw unchanged when there is no closing fence', () => {
    const raw = '---\nname: x\nstill inside';
    expect(stripFrontmatter(raw)).toBe(raw);
  });

  it('returns raw unchanged when there is no opening fence', () => {
    expect(stripFrontmatter('plain body')).toBe('plain body');
  });
});
