import { describe, it, expect } from 'vitest';
import { readSkill } from './skills';

describe('readSkill', () => {
  it('rejects traversal and otherwise invalid slugs before any disk read', async () => {
    for (const bad of ['../etc', 'a/b', '.', '..', 'foo.md', 'foo bar', '', 'x'.repeat(81)]) {
      expect(await readSkill(bad)).toBeNull();
    }
  });

  it('returns null for a well-formed slug that does not exist', async () => {
    expect(await readSkill('definitely-not-a-real-skill-xyz')).toBeNull();
  });
});
