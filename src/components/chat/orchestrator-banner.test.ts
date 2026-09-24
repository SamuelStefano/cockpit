import { describe, it, expect } from 'vitest';
import { isOrchestratorSession } from './orchestrator-banner';

describe('isOrchestratorSession', () => {
  it('true when the open session matches the Orchestrator sessionId', () => {
    expect(isOrchestratorSession('sid-1', 'sid-1')).toBe(true);
  });

  it('false for a different session', () => {
    expect(isOrchestratorSession('sid-1', 'sid-2')).toBe(false);
  });

  it('false while orchestratorSessionId has not been answered yet', () => {
    expect(isOrchestratorSession('sid-1', undefined)).toBe(false);
  });

  it('false with no open session', () => {
    expect(isOrchestratorSession(undefined, 'sid-1')).toBe(false);
  });
});
