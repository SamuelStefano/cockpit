import { describe, it, expect } from 'vitest';
import { splitFences } from './primitives';

describe('splitFences', () => {
  it('returns a single prose segment when there is no fence', () => {
    expect(splitFences('just text\nmore text')).toEqual([
      { t: 'prose', text: 'just text\nmore text' },
    ]);
  });

  it('extracts a fenced block with its language', () => {
    expect(splitFences('```ts\nconst x = 1;\n```')).toEqual([
      { t: 'code', lang: 'ts', code: 'const x = 1;' },
    ]);
  });

  it('keeps blank lines inside the code block (regression #128)', () => {
    const md = '```js\na\n\nb\n```';
    expect(splitFences(md)).toEqual([
      { t: 'code', lang: 'js', code: 'a\n\nb' },
    ]);
  });

  it('interleaves prose and code in order', () => {
    const md = 'before\n```\ncode\n```\nafter';
    expect(splitFences(md)).toEqual([
      { t: 'prose', text: 'before' },
      { t: 'code', lang: '', code: 'code' },
      { t: 'prose', text: 'after' },
    ]);
  });

  it('treats an unterminated fence as code to end of input', () => {
    expect(splitFences('```py\nx = 1\ny = 2')).toEqual([
      { t: 'code', lang: 'py', code: 'x = 1\ny = 2' },
    ]);
  });

  it('drops whitespace-only prose between fences', () => {
    const md = '```\na\n```\n\n```\nb\n```';
    expect(splitFences(md)).toEqual([
      { t: 'code', lang: '', code: 'a' },
      { t: 'code', lang: '', code: 'b' },
    ]);
  });

  it('captures an empty code block', () => {
    expect(splitFences('```\n```')).toEqual([
      { t: 'code', lang: '', code: '' },
    ]);
  });
});
