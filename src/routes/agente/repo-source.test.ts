import { describe, expect, it } from 'vitest';
import { sourceStatus } from './repo-source';

describe('sourceStatus', () => {
  const source = { repo: 'a/b', path: 'maria' };
  it('is empty for a bot without a repo', () => {
    expect(sourceStatus(null)).toBeNull();
    expect(sourceStatus({})).toBeNull();
  });
  it('shows pending, error and the synced commit', () => {
    expect(sourceStatus({ source })?.text).toBe('sincronizando…');
    expect(sourceStatus({ source, sourceSync: { at: 1, error: 'sem acesso' } })).toEqual({ tone: 'red', text: 'sem acesso' });
    expect(sourceStatus({ source, sourceSync: { at: 1, commit: 'abc1234' } })?.text).toMatch(/^main abc1234 · /);
  });
});
