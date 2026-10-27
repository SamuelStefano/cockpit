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
  pinnedAgents, pinAgent, deviceKeys, adoptPasskey, passkeyDevice, canAdoptPasskey, savePreauth, pendingPreauth, clearPreauth, PREAUTH_KEEP_MS,
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

describe('passkey device key', () => {
  it('replaces the random key once adopted, and keeps no raw PRF material', async () => {
    const before = await deviceKeys();
    const d = await deriveFromPrf(new Uint8Array(32).fill(3));
    await adoptPasskey(d);
    const after = await deviceKeys();
    expect(after.pub).toEqual(d.pub);
    expect(after.pub).not.toEqual(before.pub);
    expect((await passkeyDevice())?.pub).toEqual(d.pub);
    for (const v of data.values()) expect(v).not.toBeInstanceOf(Uint8Array);
  });

  it('is not offered to a browser already enrolled with its random key', async () => {
    expect(await canAdoptPasskey()).toBe(true);
    await pinAgent(new Uint8Array([1]), A);
    expect(await canAdoptPasskey()).toBe(false);
  });

  it('keeps the pending device secret until cleared or expired', async () => {
    await savePreauth(new Uint8Array(16).fill(7), 1000);
    expect([...(await pendingPreauth(1000))!]).toEqual(new Array(16).fill(7));
    expect(await pendingPreauth(1000 + PREAUTH_KEEP_MS)).toBeNull();
    await clearPreauth();
    expect(await pendingPreauth(1000)).toBeNull();
  });
});
