import { describe, it, expect } from 'vitest';
import { chipScaleFor } from './CanvasFlowArrows';

describe('chipScaleFor', () => {
  it('keeps the flow chip readable when zoomed out, and unscaled at or above 1', () => {
    expect(chipScaleFor(0.25)).toBe(4);
    expect(chipScaleFor(0.5)).toBe(2);
    expect(chipScaleFor(1)).toBe(1);
    expect(chipScaleFor(2)).toBe(1);
    expect(chipScaleFor(0)).toBe(1);
  });
});
