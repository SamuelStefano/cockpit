import { describe, it, expect } from 'vitest';
import { communityHue, communityColor, repoHue, repoColor } from './community-color';

describe('communityHue', () => {
  it('é determinística e fica em [0,360)', () => {
    for (const c of [0, 1, 7, 88, 109, 1000]) {
      const h = communityHue(c);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
      expect(communityHue(c)).toBe(h); // estável
    }
  });

  it('separa comunidades adjacentes (ângulo áureo)', () => {
    expect(Math.abs(communityHue(1) - communityHue(2))).toBeGreaterThan(20);
  });
});

describe('communityColor', () => {
  it('emite hsl opaco e hsla translúcido', () => {
    expect(communityColor(3)).toMatch(/^hsl\(/);
    expect(communityColor(3, 0.3)).toMatch(/^hsla\(.*0\.3\)$/);
  });
});

describe('repoHue / repoColor', () => {
  it('é determinística por nome e fica em [0,360)', () => {
    expect(repoHue('dfl-payments')).toBe(repoHue('dfl-payments'));
    expect(repoHue('cockpit')).toBeGreaterThanOrEqual(0);
    expect(repoHue('cockpit')).toBeLessThan(360);
  });
  it('separa repos diferentes', () => {
    expect(repoHue('dfl-payments')).not.toBe(repoHue('uber-money'));
  });
  it('emite hsl/hsla', () => {
    expect(repoColor('cockpit')).toMatch(/^hsl\(/);
    expect(repoColor('cockpit', 0.4)).toMatch(/^hsla\(.*0\.4\)$/);
  });
});
