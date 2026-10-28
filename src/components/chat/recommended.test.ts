import { describe, it, expect } from 'vitest';
import { parseRecommended } from './recommended';

describe('parseRecommended', () => {
  it('strips the marker and flags the option', () => {
    expect(parseRecommended('Comparar direto (Recomendada)')).toEqual({ label: 'Comparar direto', recommended: true });
    expect(parseRecommended('Ship it (Recommended)')).toEqual({ label: 'Ship it', recommended: true });
  });
  it('leaves other labels alone', () => {
    expect(parseRecommended('Cortar')).toEqual({ label: 'Cortar', recommended: false });
  });
});
