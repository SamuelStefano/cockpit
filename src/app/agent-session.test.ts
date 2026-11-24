import { describe, it, expect } from 'vitest';
import { agentIdForSession } from './agent-session';

const bots = [{ id: 'capo1', sessionId: 's-1' }, { id: 'ana22' }];

describe('agentIdForSession', () => {
  it('matches a bound session and a draft key', () => {
    expect(agentIdForSession(bots, 's-1')).toBe('capo1');
    expect(agentIdForSession(bots, 'new-bot-ana22')).toBe('ana22');
  });

  it('matches the thread key of a known bot only', () => {
    expect(agentIdForSession(bots, 'bot-capo1')).toBe('capo1');
    expect(agentIdForSession(bots, 'bot-ghost9')).toBeNull();
  });

  it('is null for a plain conversation or no session', () => {
    expect(agentIdForSession(bots, 's-2')).toBeNull();
    expect(agentIdForSession(bots, '')).toBeNull();
  });
});
