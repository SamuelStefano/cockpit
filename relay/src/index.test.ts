import { describe, it, expect } from 'vitest';
import { secretEquals } from './index';

describe('secretEquals', () => {
  it('matches only the exact secret', () => {
    expect(secretEquals('s3cret', 's3cret')).toBe(true);
    expect(secretEquals('s3cret', 's3cres')).toBe(false);
  });

  it('rejects a different length without throwing', () => {
    expect(secretEquals('s3cret', 's3')).toBe(false);
    expect(secretEquals('s3cret', 's3cret-and-more')).toBe(false);
  });

  it('denies when no secret is configured', () => {
    expect(secretEquals(undefined, '')).toBe(false);
    expect(secretEquals('', '')).toBe(false);
  });
});
