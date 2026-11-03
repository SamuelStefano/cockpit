import { describe, it, expect } from 'vitest';
import { splitSessionRefs, resolveSessionRef } from './session-link';

const A = '4248d7d1-aaaa-bbbb-cccc-0123456789ab';
const B = '4248d7d1-ffff-bbbb-cccc-0123456789ab';
const C = '9f3a1c2e-aaaa-bbbb-cccc-0123456789ab';

describe('splitSessionRefs', () => {
  it('finds short and full ids', () => {
    const parts = splitSessionRefs(`see 4248d7d1 and ${C}.`);
    expect(parts.filter((p) => p.type === 'ref').map((p) => p.value)).toEqual(['4248d7d1', C]);
  });
  it('ignores ids glued to other word chars', () => {
    expect(splitSessionRefs('abc4248d7d1 4248d7d1x deadbeef-cafe').some((p) => p.type === 'ref')).toBe(false);
  });
  it('keeps surrounding text', () => {
    expect(splitSessionRefs('a 4248d7d1 b').map((p) => p.value).join('')).toBe('a 4248d7d1 b');
  });
});

describe('resolveSessionRef', () => {
  it('resolves unique prefix and full id', () => {
    expect(resolveSessionRef('9f3a1c2e', [A, C])).toBe(C);
    expect(resolveSessionRef(C.toUpperCase(), [A, C])).toBe(C);
  });
  it('rejects ambiguous prefix and unknown id', () => {
    expect(resolveSessionRef('4248d7d1', [A, B])).toBeNull();
    expect(resolveSessionRef('deadbeef', [A, C])).toBeNull();
  });
});
