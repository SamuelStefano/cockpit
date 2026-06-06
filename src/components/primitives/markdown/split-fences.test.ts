import { describe, it, expect } from 'vitest';
import { splitFences } from './split-fences';

describe('splitFences', () => {
  it('returns a single prose segment when there is no fence', () => {
    expect(splitFences('hello\nworld')).toEqual([{ t: 'prose', text: 'hello\nworld' }]);
  });

  it('captures the language tag and code body of a fence', () => {
    const md = '```ts\nconst x = 1;\n```';
    expect(splitFences(md)).toEqual([{ t: 'code', lang: 'ts', code: 'const x = 1;' }]);
  });

  it('keeps blank lines inside a fence instead of splitting the block', () => {
    const md = '```\na\n\nb\n```';
    expect(splitFences(md)).toEqual([{ t: 'code', lang: '', code: 'a\n\nb' }]);
  });

  it('separates prose around a fence and drops empty prose', () => {
    const md = 'before\n```js\ncode\n```\nafter';
    expect(splitFences(md)).toEqual([
      { t: 'prose', text: 'before' },
      { t: 'code', lang: 'js', code: 'code' },
      { t: 'prose', text: 'after' },
    ]);
  });

  it('treats an unterminated fence as code through end of input', () => {
    const md = '```py\nstillcode';
    expect(splitFences(md)).toEqual([{ t: 'code', lang: 'py', code: 'stillcode' }]);
  });

  it('omits whitespace-only prose segments', () => {
    const md = '```\nx\n```\n\n   ';
    expect(splitFences(md)).toEqual([{ t: 'code', lang: '', code: 'x' }]);
  });
});
