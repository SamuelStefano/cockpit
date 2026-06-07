import { describe, it, expect } from 'vitest';
import { safeMode, projectSlug } from './config';

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
  it('passes through default and acceptEdits', () => {
    expect(safeMode('default')).toBe('default');
    expect(safeMode('acceptEdits')).toBe('acceptEdits');
  });

  // CRÍTICO: bypassPermissions = RCE root numa máquina com sudo NOPASSWD.
  // NUNCA pode passar — qualquer valor não-allowlistado cai pra 'plan'.
  it('never lets bypassPermissions through (falls back to plan)', () => {
    expect(safeMode('bypassPermissions')).toBe('plan');
  });

  it('falls back to plan for undefined or unknown values', () => {
    expect(safeMode(undefined)).toBe('plan');
    expect(safeMode('plan')).toBe('plan');
    expect(safeMode('garbage')).toBe('plan');
    expect(safeMode('')).toBe('plan');
  });
});
