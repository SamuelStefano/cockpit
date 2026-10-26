import { describe, it, expect } from 'vitest';
import { computerActive, diskLine, previewText, profileLine } from './computer-view';

describe('computer-view', () => {
  it('marks the computer active while the bot works or the terminal lives', () => {
    expect(computerActive('idle', false)).toBe(false);
    expect(computerActive('done', false)).toBe(false);
    expect(computerActive('thinking', false)).toBe(true);
    expect(computerActive('working', false)).toBe(true);
    expect(computerActive('idle', true)).toBe(true);
  });

  it('keeps the last preview lines', () => {
    expect(previewText(['a', 'b', 'c'], 2)).toBe('b\nc');
    expect(previewText([])).toBe('');
  });

  it('formats disk and profile', () => {
    expect(diskLine({ files: 0, bytes: 0, truncated: false })).toBe('vazio');
    expect(profileLine('restricted')).toMatch(/travado/);
  });
});
