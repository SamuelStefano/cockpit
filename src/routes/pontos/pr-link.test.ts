import { describe, it, expect } from 'vitest';
import { prUrl } from './pr-link';

describe('prUrl', () => {
  it('maps the nicknames used in the marathon file to the real repos', () => {
    expect(prUrl('LS#577')).toBe('https://github.com/devfellowship/dfl-lesson-studio/pull/577');
    expect(prUrl('campaigns#84')).toBe('https://github.com/devfellowship/dfl-campaigns/pull/84');
    expect(prUrl('itera-player#507')).toBe('https://github.com/iterahq/itera-player/pull/507');
    expect(prUrl('dfl-schema#12')).toBe('https://github.com/devfellowship/dfl-schema/pull/12');
  });

  it('links the first PR of a range', () => {
    expect(prUrl('services#222–#224')).toBe('https://github.com/devfellowship/dfl-services/pull/222');
  });

  it('returns null for free text or an unknown repo', () => {
    expect(prUrl('~25 PRs')).toBeNull();
    expect(prUrl('whatever#3')).toBeNull();
  });
});
