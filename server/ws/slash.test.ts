import { describe, it, expect } from 'vitest';
import { SEED_SLASH, getSlashCommands, applySlashCommands } from './slash';

describe('applySlashCommands', () => {
  it('seeds the palette before the CLI reports anything', () => {
    expect(getSlashCommands()).toEqual(SEED_SLASH);
  });

  it('appends CLI commands after the seed and dedupes ones already seeded', () => {
    applySlashCommands(['help', 'compact', 'review']);
    const got = getSlashCommands();
    expect(got.slice(0, SEED_SLASH.length)).toEqual(SEED_SLASH);
    expect(got.slice(SEED_SLASH.length)).toEqual(['compact', 'review']);
    expect(got.filter((c) => c === 'help')).toHaveLength(1);
  });

  it('is idempotent when the reported set is unchanged', () => {
    applySlashCommands(['compact', 'review']);
    expect(getSlashCommands()).toEqual([...SEED_SLASH, 'compact', 'review']);
  });
});
