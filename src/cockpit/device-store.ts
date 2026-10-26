import type { DeviceKeys } from '../../shared/e2e/device';
import { fromB64, toB64, type Bytes } from '../../shared/e2e/bytes';
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

export async function pinnedAgents(): Promise<Bytes[]> {
  const list = (await get<string[]>('pins')) ?? [];
  return list.map(fromB64);
}

export async function pinAgent(pub: Bytes): Promise<void> {
  const b64 = toB64(pub);
  const list = (await get<string[]>('pins')) ?? [];
  if (!list.includes(b64)) await put('pins', [...list, b64]);
}
