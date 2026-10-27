import { describe, expect, it } from 'vitest';
import { DEFAULT_MODE, modeChipOf } from './composer-mode';

describe('modeChipOf', () => {
  it('is silent for the default mode', () => {
    expect(modeChipOf(DEFAULT_MODE)).toBeNull();
  });

  it('flags every other mode', () => {
    expect(modeChipOf('plan')?.label).toBe('Planejar');
    expect(modeChipOf('acceptEdits')?.label).toBe('Executar');
  });
});
