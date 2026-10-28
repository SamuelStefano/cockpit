import { describe, expect, it } from 'vitest';
import { bitStateFor } from './bit-state';

describe('bitStateFor', () => {
  it('shows the error face on a dead link', () => {
    expect(bitStateFor({ conn: 'closed', agentOnline: true })).toBe('error');
  });
  it('sleeps when the box is offline', () => {
    expect(bitStateFor({ conn: 'open', agentOnline: false })).toBe('sleeping');
  });
  it('connects while reconnecting', () => {
    expect(bitStateFor({ conn: 'connecting' })).toBe('connecting');
  });
  it('reflects live work', () => {
    expect(bitStateFor({ conn: 'open', agentOnline: true, running: true, thinking: true })).toBe('thinking');
    expect(bitStateFor({ conn: 'open', agentOnline: true, running: true })).toBe('working');
    expect(bitStateFor({ conn: 'open', agentOnline: true })).toBe('idle');
  });
});
