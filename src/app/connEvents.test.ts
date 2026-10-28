import { describe, it, expect, vi, afterEach } from 'vitest';
import { CONN_EVENTS_MAX, noteRelayFrame, recentConnEvents, recordConnEvent, relayAnsweredSinceDial, resetConnEvents } from './connEvents';

afterEach(() => { resetConnEvents(); vi.useRealTimers(); });

describe('connection event ring', () => {
  it(`keeps the last ${CONN_EVENTS_MAX} events`, () => {
    for (let i = 0; i < CONN_EVENTS_MAX + 10; i++) recordConnEvent('e', { i });
    const ev = recentConnEvents();
    expect(ev).toHaveLength(CONN_EVENTS_MAX);
    expect(ev[0].i).toBe(10);
  });

  it('knows whether the relay answered since the last dial', () => {
    vi.useFakeTimers();
    expect(relayAnsweredSinceDial()).toBe(false);
    recordConnEvent('dial');
    vi.advanceTimersByTime(10);
    noteRelayFrame('agent-offline');
    expect(relayAnsweredSinceDial()).toBe(true);
    vi.advanceTimersByTime(10);
    recordConnEvent('dial');
    expect(relayAnsweredSinceDial()).toBe(false);
  });
});
