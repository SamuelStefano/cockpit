import { describe, it, expect } from 'vitest';
import { parseFrontmatter, unquote, stripFrontmatter } from './contexts';

describe('parseFrontmatter', () => {
  it('reads name + description at top level', () => {
    const fm = parseFrontmatter('---\nname: foo\ndescription: "uma desc"\n---\ncorpo');
    expect(fm.name).toBe('foo');
    expect(fm.description).toBe('uma desc');
  });

  // Regressão: nos arquivos de memory reais o `type` vem ANINHADO sob `metadata:`.
  // O regex tolera indentação de propósito — não "consertar" pra só top-level.
  it('reads type nested under metadata:', () => {
    const raw = '---\nname: roadmap\ndescription: "x"\nmetadata: \n  node_type: memory\n  type: project\n  originSessionId: abc\n---\nbody';
    const fm = parseFrontmatter(raw);
    expect(fm.name).toBe('roadmap');
    expect(fm.type).toBe('project');
  });

  it('takes the first occurrence of each key', () => {
    const fm = parseFrontmatter('---\nname: first\nname: second\n---\n');
    expect(fm.name).toBe('first');
  });

  it('returns empty for text without frontmatter', () => {
    expect(parseFrontmatter('sem frontmatter aqui')).toEqual({});
  });
});

describe('unquote', () => {
  it('strips matching double or single quotes', () => {
    expect(unquote('"hello"')).toBe('hello');
    expect(unquote("'hello'")).toBe('hello');
  });
  it('leaves unquoted or mismatched strings alone', () => {
    expect(unquote('hello')).toBe('hello');
    expect(unquote('"hello')).toBe('"hello');
  });
});

describe('stripFrontmatter', () => {
  it('removes the frontmatter block and leading whitespace', () => {
    expect(stripFrontmatter('---\nname: x\n---\n\ncorpo aqui')).toBe('corpo aqui');
  });
  it('returns the raw text when there is no frontmatter', () => {
    expect(stripFrontmatter('só corpo')).toBe('só corpo');
  });
});
