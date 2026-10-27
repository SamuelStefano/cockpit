import { describe, it, expect, beforeEach } from 'vitest';
import { isAgentUnavailable, lastProbes } from './status';

beforeEach(() => lastProbes.clear());

describe('isAgentUnavailable', () => {
  it('keeps agents that were never tested', () => {
    expect(isAgentUnavailable('grok')).toBe(false);
  });
  it('flags every non-ready probe result', () => {
    for (const status of ['needs-login', 'not-installed', 'error'] as const) {
      lastProbes.set('grok', { status, message: '', at: 1 });
      expect(isAgentUnavailable('grok')).toBe(true);
    }
  });
  it('keeps a ready agent', () => {
    lastProbes.set('grok', { status: 'ready', message: '', at: 1 });
    expect(isAgentUnavailable('grok')).toBe(false);
  });
});
