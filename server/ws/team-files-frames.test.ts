import { describe, it, expect } from 'vitest';
import { ownBotId } from './team-files-frames';

describe('ownBotId', () => {
  it('serves only a bot of the team', () => {
    const team = [{ id: 'capo1' }];
    expect(ownBotId(team, 'capo1')).toBe('capo1');
    expect(ownBotId(team, 'gone11')).toBeUndefined();
    expect(ownBotId(team, 42)).toBeUndefined();
  });
});
