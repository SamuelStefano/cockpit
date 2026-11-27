import { describe, it, expect } from 'vitest';
import { safeMode, projectSlug, positiveOrUndefined } from './config';

describe('positiveOrUndefined', () => {
  it('só aceita número finito positivo; resto vira undefined (sem teto)', () => {
    expect(positiveOrUndefined('2.5')).toBe(2.5);
    for (const bad of [undefined, '', '0', '-1', 'abc', 'Infinity']) expect(positiveOrUndefined(bad)).toBeUndefined();
  });
});

describe('projectSlug', () => {
  it('mirrors the CLI: replaces path separators with dash', () => {
    expect(projectSlug('/home/samuel')).toBe('-home-samuel');
    expect(projectSlug('/home/joao')).toBe('-home-joao');
    expect(projectSlug('/home/samuel/cockpit')).toBe('-home-samuel-cockpit');
  });

  it('replaces dots and backslashes too', () => {
    expect(projectSlug('/home/u.ser')).toBe('-home-u-ser');
    expect(projectSlug('C:\\Users\\x')).toBe('C--Users-x');
  });
});

describe('safeMode', () => {
  it('passes through default, acceptEdits and an explicit plan', () => {
    expect(safeMode('default')).toBe('default');
    expect(safeMode('acceptEdits')).toBe('acceptEdits');
    expect(safeMode('plan')).toBe('plan');
  });

  // CRÍTICO: bypassPermissions = RCE root numa máquina com sudo NOPASSWD.
  // NUNCA pode passar — qualquer valor não-allowlistado cai pra 'acceptEdits'.
  it('never lets bypassPermissions through (falls back to acceptEdits)', () => {
    expect(safeMode('bypassPermissions')).toBe('acceptEdits');
  });

  it('falls back to acceptEdits for undefined or unknown values', () => {
    expect(safeMode(undefined)).toBe('acceptEdits');
    expect(safeMode('garbage')).toBe('acceptEdits');
    expect(safeMode('')).toBe('acceptEdits');
  });
});
