import { beforeEach, describe, expect, it } from 'vitest';
import { resetViewportBaseline, viewportShrunk } from './keyboard-shrunk';

beforeEach(resetViewportBaseline);

describe('viewportShrunk', () => {
  it('detects the keyboard when innerHeight stays tall', () => {
    expect(viewportShrunk(700, 700, 390)).toBe(false);
    expect(viewportShrunk(420, 700, 390)).toBe(true);
  });
  it('detects the keyboard when innerHeight shrinks with it', () => {
    expect(viewportShrunk(700, 700, 390)).toBe(false);
    expect(viewportShrunk(420, 420, 390)).toBe(true);
  });
  it('ignores the address bar and resets on rotation', () => {
    expect(viewportShrunk(700, 700, 390)).toBe(false);
    expect(viewportShrunk(620, 620, 390)).toBe(false);
    expect(viewportShrunk(360, 360, 844)).toBe(false);
  });
});
