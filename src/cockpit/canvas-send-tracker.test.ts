import { describe, it, expect } from 'vitest';
import { aliasRoutedKey, type PendingCanvasSend } from './canvas-send-tracker';

describe('aliasRoutedKey', () => {
  it('aliases the pending entry under the routed key, keeping the original sessionId', () => {
    const pending = new Map<string, PendingCanvasSend>([['s1', { msgId: 'm1', text: 'oi', sessionId: 's1' }]]);
    const msgIdIndex = new Map([['m1', 's1']]);
    aliasRoutedKey(pending, msgIdIndex, 'm1', 'cron-nightly');
    expect(pending.get('cron-nightly')).toEqual({ msgId: 'm1', text: 'oi', sessionId: 's1' });
    expect(pending.get('s1')).toEqual({ msgId: 'm1', text: 'oi', sessionId: 's1' }); // original untouched
  });

  it('a no-op when the routed key IS the sessionId (the common, non-rerouted case)', () => {
    const pending = new Map<string, PendingCanvasSend>([['s1', { msgId: 'm1', text: 'oi', sessionId: 's1' }]]);
    const msgIdIndex = new Map([['m1', 's1']]);
    aliasRoutedKey(pending, msgIdIndex, 'm1', 's1');
    expect(pending.size).toBe(1);
  });

  it('a no-op when the msgId is not a tracked canvas send (a normal composer triage)', () => {
    const pending = new Map<string, PendingCanvasSend>();
    const msgIdIndex = new Map<string, string>();
    aliasRoutedKey(pending, msgIdIndex, 'unrelated-msg', 'cron-nightly');
    expect(pending.size).toBe(0);
  });

  it('a no-op when the msgId was already cleaned up (pending entry gone)', () => {
    const pending = new Map<string, PendingCanvasSend>();
    const msgIdIndex = new Map([['m1', 's1']]);
    aliasRoutedKey(pending, msgIdIndex, 'm1', 'cron-nightly');
    expect(pending.has('cron-nightly')).toBe(false);
  });
});
