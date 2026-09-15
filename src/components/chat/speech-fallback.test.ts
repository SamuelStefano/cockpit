// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { rememberEngineFailure, hasRecentEngineFailure, forgetEngineFailure, ENGINE_FAILURE_TTL_MS } from './speech-fallback';

beforeEach(() => forgetEngineFailure());

describe('speech-fallback', () => {
  it('starts clean', () => {
    expect(hasRecentEngineFailure()).toBe(false);
  });

  it('remembers a failure inside the TTL', () => {
    rememberEngineFailure(1_000);
    expect(hasRecentEngineFailure(1_000 + ENGINE_FAILURE_TTL_MS - 1)).toBe(true);
  });

  it('forgets once the TTL expires', () => {
    rememberEngineFailure(1_000);
    expect(hasRecentEngineFailure(1_000 + ENGINE_FAILURE_TTL_MS)).toBe(false);
  });

  it('forget clears the flag', () => {
    rememberEngineFailure();
    forgetEngineFailure();
    expect(hasRecentEngineFailure()).toBe(false);
  });
});
