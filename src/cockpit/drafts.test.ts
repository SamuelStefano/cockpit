import { describe, it, expect } from 'vitest';
import { persistableDrafts } from './drafts';

describe('persistableDrafts', () => {
  it('keeps non-empty drafts of real sessions only', () => {
    expect(persistableDrafts({ 'new-abc': 'x', u1: '', u2: 'keep' })).toEqual({ u2: 'keep' });
  });
});
