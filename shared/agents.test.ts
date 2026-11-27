import { describe, it, expect } from 'vitest';
import { billsClaudePlan, composerLocked } from './agents';

describe('composerLocked', () => {
  it('Claude window pauses a Claude chat', () => {
    expect(composerLocked(true, 'claude-opus-5-5')).toBe(true);
    expect(composerLocked(true, undefined)).toBe(true);
    expect(composerLocked(false, 'claude-opus-5-5')).toBe(false);
  });

  it('Grok chip on screen stays open when Claude tokens are gone', () => {
    expect(composerLocked(true, 'agent:grok')).toBe(false);
    expect(composerLocked(true, 'agent:codex')).toBe(false);
    expect(billsClaudePlan('agent:grok')).toBe(false);
  });
});
