import { describe, it, expect } from 'vitest';
import { withoutBotThreads } from './bot-threads';

describe('withoutBotThreads', () => {
  it('drops bot drafts, server bot keys and bound bot sessions', () => {
    const rows = [{ id: 'new-bot-abcd1' }, { id: 'bot-abcd2' }, { id: 'sid-bot' }, { id: 'sid-user' }, { id: 'new-xyz' }];
    expect(withoutBotThreads(rows, [{ sessionId: 'sid-bot' }, { sessionId: undefined }]).map((r) => r.id)).toEqual(['sid-user', 'new-xyz']);
  });
});
