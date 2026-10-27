import { describe, expect, it } from 'vitest';
import { leftConversation } from './session-switch';

describe('leftConversation', () => {
  it('keeps the call when the new- key migrates to its real id', () => {
    expect(leftConversation('new-abc', 'uuid-1', 'uuid-1')).toBe(false);
  });

  it('ends the call when the user opens another session', () => {
    expect(leftConversation('uuid-1', 'uuid-2', undefined)).toBe(true);
    expect(leftConversation('new-abc', 'uuid-2', 'uuid-1')).toBe(true);
  });

  it('ignores the first pick and unchanged keys', () => {
    expect(leftConversation('', 'uuid-1', undefined)).toBe(false);
    expect(leftConversation('uuid-1', 'uuid-1', undefined)).toBe(false);
  });
});
