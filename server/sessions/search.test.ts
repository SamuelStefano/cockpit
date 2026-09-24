import { describe, it, expect } from 'vitest';
import { makeSnippet, extractText, matchSnippet } from './search';

describe('makeSnippet', () => {
  it('returns null when the term is absent', () => {
    expect(makeSnippet('nothing here', 'xyz')).toBeNull();
  });

  it('is case-insensitive on the match', () => {
    expect(makeSnippet('Hello World', 'world')).toBe('Hello World…');
  });

  it('omits the leading ellipsis when the hit is at the start', () => {
    const out = makeSnippet('alpha beta gamma', 'alpha')!;
    expect(out.startsWith('…')).toBe(false);
    expect(out.endsWith('…')).toBe(true);
  });

  it('adds a leading ellipsis when the window is cut on the left', () => {
    const text = 'x'.repeat(100) + ' NEEDLE tail';
    const out = makeSnippet(text, 'NEEDLE')!;
    expect(out.startsWith('…')).toBe(true);
    expect(out).toContain('NEEDLE');
  });

  it('collapses runs of whitespace', () => {
    expect(makeSnippet('foo    bar\n\nbaz', 'foo')).toBe('foo bar baz…');
  });
});

describe('extractText', () => {
  it('returns a string content as-is', () => {
    expect(extractText('hello')).toBe('hello');
  });

  it('joins only text parts of an array', () => {
    expect(extractText([
      { type: 'text', text: 'a' },
      { type: 'tool_use', name: 'Bash' },
      { type: 'text', text: 'b' },
    ])).toBe('a b');
  });

  it('returns empty string for other shapes', () => {
    expect(extractText(null)).toBe('');
    expect(extractText({ foo: 1 })).toBe('');
  });
});

describe('matchSnippet', () => {
  it('does not leak a file descriptor when it stops at the first hit', async () => {
    const { mkdtempSync, writeFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'deck-search-'));
    const f = join(dir, 's.jsonl');
    const line = JSON.stringify({ type: 'user', message: { content: 'procura o termo aqui' } });
    writeFileSync(f, Array(2000).fill(line).join('\n'));
    const fds = () => readdirSync('/proc/self/fd').length;
    await matchSnippet(f, 'termo');
    const before = fds();
    for (let i = 0; i < 20; i++) expect(await matchSnippet(f, 'termo')).toContain('termo');
    await new Promise((r) => setTimeout(r, 20));
    expect(fds() - before).toBeLessThan(3);
  });
});
