import { describe, it, expect } from 'vitest';
import { isBoxId, sanitizeBoxLabel, BOX_LABEL_MAX } from './boxes';

describe('isBoxId', () => {
  it('accepts a uuid and nothing else', () => {
    expect(isBoxId('0b9c6f5e-1d2a-4c3b-8e7f-123456789abc')).toBe(true);
    expect(isBoxId('ag-1')).toBe(false);
    expect(isBoxId('0b9c6f5e-1d2a-4c3b-8e7f-123456789abc&x=1')).toBe(false);
    expect(isBoxId(42)).toBe(false);
  });
});

describe('sanitizeBoxLabel', () => {
  it('strips control and bidi characters and collapses whitespace', () => {
    expect(sanitizeBoxLabel('  pc\u001b[31m  casa\n')).toBe('pc [31m casa');
    expect(sanitizeBoxLabel('vps‮gpj')).toBe('vps gpj');
  });

  it('caps the length in code points', () => {
    expect([...sanitizeBoxLabel('é'.repeat(100))]).toHaveLength(BOX_LABEL_MAX);
  });

  it('turns a non-string into an empty label', () => {
    expect(sanitizeBoxLabel(undefined)).toBe('');
    expect(sanitizeBoxLabel({ toString: () => 'x' })).toBe('');
  });
});
