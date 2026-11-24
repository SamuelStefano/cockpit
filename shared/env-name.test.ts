import { describe, it, expect } from 'vitest';
import { validEnvName } from './env-name';

describe('validEnvName', () => {
  it('accepts shell-style names and rejects the rest', () => {
    expect(validEnvName('GITHUB_TOKEN')).toBe(true);
    expect(validEnvName('_x1')).toBe(true);
    expect(validEnvName('1TOKEN')).toBe(false);
    expect(validEnvName('MY-TOKEN')).toBe(false);
    expect(validEnvName('A B')).toBe(false);
    expect(validEnvName('')).toBe(false);
  });
});
