import type { DeviceKeys } from '../../shared/e2e/device';
import { fromB64, toB64, type Bytes } from '../../shared/e2e/bytes';
import { isBoxId } from '../../shared/boxes';
import { publicRaw, type KeyPair } from '../../shared/e2e/channel';

// This device's signing key and the agent keys it trusts. The private key is
// created non-extractable and kept in IndexedDB as a CryptoKey: page code can
// ask it to sign, but nothing (an XSS included) can copy it off the device.

const DB = 'deck-e2e';
const STORE = 'kv';

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function get<T>(key: string): Promise<T | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
  });
}

async function put(key: string, value: unknown): Promise<void> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

let cached: Promise<DeviceKeys> | null = null;

export function deviceKeys(): Promise<DeviceKeys> {
  cached ??= (async () => {
    let pair = await get<KeyPair>('device');
    if (!pair) {
      pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']) as unknown as KeyPair;
      await put('device', pair);
    }
    return { pub: await publicRaw(pair.publicKey), sign: pair.privateKey };
  })();
  cached.catch(() => { cached = null; });
  return cached;
}

// A socket bound to a box reads and writes ONLY that box's slot. The handshake
// carries no agent id, so falling back to another slot would let a relay answer
// box A's dial with box B's key. The legacy single `pins` slot serves unbound
// sockets only and is never copied into a box slot.
function slot(box?: string): string {
  if (box === undefined) return 'pins';
  if (!isBoxId(box)) throw new Error('invalid box id');
  return `pins:${box.toLowerCase()}`;
}

export async function pinnedAgents(box?: string): Promise<Bytes[]> {
  const list = (await get<string[]>(slot(box))) ?? [];
  return list.map(fromB64);
}

// A new enrollment REPLACES the box's pin, so the key of a box that was wiped or
// re-provisioned stops being trusted right away.
export async function pinAgent(pub: Bytes, box?: string): Promise<void> {
  await put(slot(box), [toB64(pub)]);
}
