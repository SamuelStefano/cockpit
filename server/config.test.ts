import { describe, it, expect } from 'vitest';
import { safeMode } from './config';

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
