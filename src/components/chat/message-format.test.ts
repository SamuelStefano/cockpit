import { describe, it, expect } from 'vitest';
import { fmtTokens, fmtToolDuration } from './message-format';
import { fmtTokensK } from './Thinking';
import { fmtElapsed } from './BackgroundAgents';

describe('chat formats agree', () => {
  it('formats tokens the same in the live line and the turn footer', () => {
    expect(fmtTokens(18_000)).toBe('18k');
    expect(fmtTokens(1_200)).toBe('1.2k');
    expect(fmtTokensK(18_000)).toBe(fmtTokens(18_000));
  });

  it('keeps sub-second tool times and folds long ones into minutes', () => {
    expect(fmtToolDuration(400)).toBe('0.4s');
    expect(fmtToolDuration(125_300)).toBe('2m 5s');
  });

  it('shows background agent time like the turn timer', () => {
    expect(fmtElapsed(65_000)).toBe('1m 5s');
  });
});
