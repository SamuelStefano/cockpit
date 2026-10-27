import type { DeviceKeys } from '../../shared/e2e/device';
import { fromB64, toB64, type Bytes } from '../../shared/e2e/bytes';
import { isBoxId } from '../../shared/boxes';
import { publicRaw, type KeyPair } from '../../shared/e2e/channel';
import type { PasskeyDevice } from '../../shared/e2e/passkey';

// This device's signing key and the agent keys it trusts. The private key is
// created non-extractable and kept in IndexedDB as a CryptoKey: page code can
// ask it to sign, but nothing (an XSS included) can copy it off the device.
// A passkey-derived key (shared/e2e/passkey.ts), when there is one, is used
// instead of the random key; it is stored the same way, so the passkey prompt
// happens once per browser and not per page load.

const DB = 'deck-e2e';
const STORE = 'kv';
const PASSKEY = 'device-passkey';
// Boxes that trust the passkey key: the browser talks to them with it. Any other
// box this browser pinned with its random key keeps that key until the browser
// hands it the passkey key over its sealed channel (device-add-passkey).
const PASSKEY_BOXES = 'passkey-boxes';

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

interface StoredPasskey { pair: KeyPair; pinRoot: CryptoKey }

export interface PasskeyRef { pub: Bytes; pinRoot: CryptoKey }

async function randomPair(): Promise<KeyPair> {
  let pair = await get<KeyPair>('device');
  if (!pair) {
    pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']) as unknown as KeyPair;
    await put('device', pair);
  }
  return pair;
}

// The pin root stays a non-extractable HKDF key: per-box pin keys are derived
// from it when needed and never stored here.
export async function passkeyDevice(): Promise<PasskeyRef | null> {
  const p = await get<StoredPasskey>(PASSKEY);
  return p ? { pub: await publicRaw(p.pair.publicKey), pinRoot: p.pinRoot } : null;
}

export interface SelectedKeys {
  keys: DeviceKeys;
  // Set when `keys` is the passkey key.
  passkey: PasskeyRef | null;
  // Set when this browser has a passkey but this box still knows it by its
  // random key: the sealed channel then hands the box the passkey key.
  upgrade: PasskeyRef | null;
}

// Which key to dial a box with: the passkey key, unless the box already pinned
// on this browser has only ever seen the random one.
export async function deviceKeysFor(box?: string): Promise<SelectedKeys> {
  const pk = await get<StoredPasskey>(PASSKEY);
  const random = await get<KeyPair>('device');
  const ref = pk ? { pub: await publicRaw(pk.pair.publicKey), pinRoot: pk.pinRoot } : null;
  const legacy = !!random && (await pinnedAgents(box)).length > 0 && !((await get<string[]>(PASSKEY_BOXES)) ?? []).includes(slot(box));
  if (pk && ref && !legacy) return { keys: { pub: ref.pub, sign: pk.pair.privateKey }, passkey: ref, upgrade: null };
  const pair = random ?? await randomPair();
  return { keys: { pub: await publicRaw(pair.publicKey), sign: pair.privateKey }, passkey: null, upgrade: ref };
}

export async function markPasskeyBox(box?: string): Promise<void> {
  const list = (await get<string[]>(PASSKEY_BOXES)) ?? [];
  if (!list.includes(slot(box))) await put(PASSKEY_BOXES, [...list, slot(box)]);
}

export async function adoptPasskey(d: PasskeyDevice): Promise<void> {
  await put(PASSKEY, { pair: d.pair, pinRoot: d.pinRoot } satisfies StoredPasskey);
  // A new passkey key is new to every box, including those the old one reached.
  await put(PASSKEY_BOXES, []);
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

// Replaces the box's pin. Only for an enroll code typed on the screen that told
// the user the box's key changed (a reinstalled agent); every other path goes
// through pinAgentIfEmpty.
export async function pinAgent(pub: Bytes, box?: string): Promise<void> {
  await put(slot(box), [toB64(pub)]);
}

// Pre-authorization, pin proofs, first use and enroll codes only fill an empty
// slot: none of them may replace the agent key this browser already trusts.
export async function pinAgentIfEmpty(pub: Bytes, box?: string): Promise<boolean> {
  if ((await pinnedAgents(box)).length > 0) return false;
  await pinAgent(pub, box);
  return true;
}
