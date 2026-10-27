import { describe, it, expect, beforeEach, vi } from 'vitest';

const data = new Map<string, unknown>();
function req<T>(run: () => T) {
  const r: { result?: T; onsuccess?: () => void; onerror?: () => void } = {};
  setTimeout(() => { r.result = run(); r.onsuccess?.(); }, 0);
  return r;
}
const fakeIdb = {
  open: () => {
    const r = req(() => ({
      transaction: () => {
        const tx: { oncomplete?: () => void; objectStore: () => unknown } = {
          objectStore: () => ({
            get: (k: string) => req(() => data.get(k)),
            getAllKeys: () => req(() => [...data.keys()]),
            put: (v: unknown, k: string) => { data.set(k, v); setTimeout(() => tx.oncomplete?.(), 0); },
          }),
        };
        return tx;
      },
    }));
    return r;
  },
};
vi.stubGlobal('indexedDB', fakeIdb);

const {
  pinnedAgents, pinAgent, pinAgentIfEmpty, deviceKeysFor, adoptPasskey, passkeyDevice, markPasskeyBox, forgetBox,
} = await import('./device-store');
const { deriveFromPrf } = await import('../../shared/e2e/passkey');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

beforeEach(() => data.clear());

describe('per-box pins', () => {
  it('keeps one pin per box', async () => {
    await pinAgent(new Uint8Array([1]), A);
    await pinAgent(new Uint8Array([2]), B);
    expect([...(await pinnedAgents(A))[0]]).toEqual([1]);
    expect([...(await pinnedAgents(B))[0]]).toEqual([2]);
  });

  it('a box with no pin does NOT fall back to the legacy pin', async () => {
    await pinAgent(new Uint8Array([9]));
    expect(await pinnedAgents(A)).toEqual([]);
    expect((await pinnedAgents()).length).toBe(1);
  });

  it('pinning a box never touches the legacy pin or other boxes', async () => {
    await pinAgent(new Uint8Array([9]));
    await pinAgent(new Uint8Array([1]), A);
    expect([...(await pinnedAgents())[0]]).toEqual([9]);
    expect(await pinnedAgents(B)).toEqual([]);
  });

  it('re-enrolling a box replaces only its pin', async () => {
    await pinAgent(new Uint8Array([1]), A);
    await pinAgent(new Uint8Array([3]), A);
    const pins = await pinnedAgents(A);
    expect(pins).toHaveLength(1);
    expect([...pins[0]]).toEqual([3]);
  });

  it('rejects a malformed box id', async () => {
    await expect(pinnedAgents('../pins')).rejects.toThrow();
  });
});

describe('pinning never replaces a trusted agent key', () => {
  it('pinAgentIfEmpty fills an empty slot and refuses a filled one', async () => {
    expect(await pinAgentIfEmpty(new Uint8Array([1]), A)).toBe(true);
    expect(await pinAgentIfEmpty(new Uint8Array([2]), A)).toBe(false);
    expect([...(await pinnedAgents(A))[0]]).toEqual([1]);
  });
});

describe('passkey device key', () => {
  it('is used once adopted on a browser with no pins, and keeps no raw PRF material', async () => {
    const before = await deviceKeysFor(A);
    expect(before.passkey).toBeNull();
    const d = await deriveFromPrf(new Uint8Array(32).fill(3));
    await adoptPasskey(d);
    const after = await deviceKeysFor(A);
    expect(after.keys.pub).toEqual(d.pub);
    expect(after.passkey?.pub).toEqual(d.pub);
    expect(after.keys.pub).not.toEqual(before.keys.pub);
    expect((await passkeyDevice())?.pub).toEqual(d.pub);
    for (const v of data.values()) expect(v).not.toBeInstanceOf(Uint8Array);
  });

  it('a box this browser pinned with its random key keeps that key until it learns the passkey', async () => {
    const random = await deviceKeysFor(A);
    await pinAgent(new Uint8Array([1]), A);
    const d = await deriveFromPrf(new Uint8Array(32).fill(4));
    await adoptPasskey(d);
    const legacy = await deviceKeysFor(A);
    expect(legacy.keys.pub).toEqual(random.keys.pub);
    expect(legacy.upgrade?.pub).toEqual(d.pub);
    expect((await deviceKeysFor(B)).keys.pub).toEqual(d.pub);
    await markPasskeyBox(A);
    expect((await deviceKeysFor(A)).keys.pub).toEqual(d.pub);
  });

  it('a new passkey is new to every box again', async () => {
    await deviceKeysFor(A);
    await pinAgent(new Uint8Array([1]), A);
    await adoptPasskey(await deriveFromPrf(new Uint8Array(32).fill(4)));
    await markPasskeyBox(A);
    const fresh = await deriveFromPrf(new Uint8Array(32).fill(5));
    await adoptPasskey(fresh);
    expect((await deviceKeysFor(A)).passkey).toBeNull();
  });
});

describe('forgetting a box', () => {
  it('clears only that box\'s pin and passkey mark', async () => {
    await pinAgent(new Uint8Array([1]), A);
    await pinAgent(new Uint8Array([2]), B);
    await markPasskeyBox(A);
    await markPasskeyBox(B);
    await forgetBox(A);
    expect(await pinnedAgents(A)).toEqual([]);
    expect(await pinnedAgents(B)).toEqual([new Uint8Array([2])]);
    expect(data.get('passkey-boxes')).toEqual([`pins:${B}`]);
    expect(await pinAgentIfEmpty(new Uint8Array([3]), A)).toBe(true);
  });
});
