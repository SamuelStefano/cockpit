import { describe, it, expect } from 'vitest';
import { parseDevices } from './useDevices';

describe('parseDevices', () => {
  it('puts this device first, then the most recently seen, and drops malformed items', () => {
    const list = parseDevices({
      t: 'devices',
      items: [
        { pub: 'a', label: 'old', addedAt: '2026-01-01T00:00:00Z', lastSeen: '2026-02-01T00:00:00Z' },
        { pub: 'b', label: 'me', addedAt: '2026-01-02T00:00:00Z', current: true },
        { pub: 'c', label: 'new', addedAt: '2026-01-03T00:00:00Z', lastSeen: '2026-03-01T00:00:00Z' },
        { label: 'no pub' },
        null,
      ],
    });
    expect(list?.map((d) => d.label)).toEqual(['me', 'new', 'old']);
  });

  it('ignores other frames', () => {
    expect(parseDevices({ t: 'device-pinned', ok: true })).toBeNull();
  });
});
