import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ENROLL_TTL_MS, checkPreauthRequest, checkRequest, newEnrollCode, parseDeviceCode } from '../../shared/e2e/enroll';
import { fromB64, toB64, type Bytes } from '../../shared/e2e/bytes';
import { withFileLockSync } from '../../shared/file-lock';

// Devices allowed to open a sealed channel to this agent. Lives next to the
// agent's private key and is only ever written from this box: from the CLI, or
// by a device that is already enrolled. The relay has no way to add one.

const DIR = () => process.env.DECK_AGENT_DIR || join(homedir(), '.deck-agent');
const DEVICES = () => join(DIR(), 'devices.json');
const CODES = () => join(DIR(), 'enroll-codes.json');
const PREAUTH = () => join(DIR(), 'preauth.json');
// lastSeen lives apart from the trust list: a busy handshake rewriting the
// trust file could otherwise put back a device the CLI had just revoked.
const SEEN = () => join(DIR(), 'devices-seen.json');
const MAX_PENDING = 5;

// `pin` is the device's per-box pin key (passkey devices only). It stays in the
// trust entry so a revoke removes it in the same write.
export interface Device { pub: string; label: string; addedAt: string; lastSeen?: string; pin?: string }
interface PendingCode { secret: string; expiresAt: number }
// usedBy: the device that redeemed it. It may redeem again until expiry (its
// grant can be lost on the way back); no other device can.
interface PendingPreauth { fp: string; secret: string; expiresAt: number; usedBy?: string }

function readJson<T>(path: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; } catch { return fallback; }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(DIR(), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(tmp, path);
}

// The trust list never takes the shared helper's "write anyway after ~500 ms"
// path: a lost update here could bring back a revoked device.
const mustLock = (lockPath: string): never => { throw new Error(`device list busy (${lockPath}); try again`); };

// A revoked key stays named in the trust file (`{ revoked }`, no `pub`, so an
// older agent just drops it): another synced browser re-offering it, or first
// use, cannot bring it back. Only an enroll code or a pairing preauth clears it.
interface Tombstone { revoked: string; at: string }
const MAX_TOMBSTONES = 200;

interface TrustFile { devices: Device[]; revoked: Tombstone[]; ok: boolean }

// Missing = empty. Present but unreadable = not empty: an empty answer would open
// first use and let it overwrite the list.
function readTrust(): TrustFile {
  let raw: string;
  try { raw = readFileSync(DEVICES(), 'utf8'); } catch (e) {
    return { devices: [], revoked: [], ok: (e as NodeJS.ErrnoException).code === 'ENOENT' };
  }
  let d: unknown;
  try { d = JSON.parse(raw); } catch { return { devices: [], revoked: [], ok: false }; }
  if (!Array.isArray(d)) return { devices: [], revoked: [], ok: false };
  return {
    devices: d.filter((x): x is Device => typeof x?.pub === 'string'),
    revoked: d.filter((x): x is Tombstone => typeof x?.revoked === 'string' && typeof x?.pub !== 'string'),
    ok: true,
  };
}

function writableTrust(): TrustFile {
  const t = readTrust();
  if (!t.ok) throw new Error(`${DEVICES()} is unreadable; fix or move it away`);
  return t;
}

function writeTrust(devices: Device[], revoked: Tombstone[]): void {
  writeJson(DEVICES(), [...devices, ...revoked.slice(-MAX_TOMBSTONES)]);
}

function trusted(): Device[] {
  return readTrust().devices;
}

function isRevoked(t: TrustFile, pub: string): boolean {
  return t.revoked.some((r) => r.revoked === pub);
}

// Never carries the pin key: this list goes to devices over their channels.
export function listDevices(): Device[] {
  const seen = readJson<Record<string, string>>(SEEN(), {});
  return trusted().map((d) => ({ pub: d.pub, label: d.label, addedAt: d.addedAt, lastSeen: seen[d.pub] }));
}

export function isEnrolled(pub: string): boolean {
  return trusted().some((d) => d.pub === pub);
}

export function hasDevices(): boolean {
  const t = readTrust();
  return !t.ok || t.devices.length > 0;
}

export function isRevokedDevice(pub: string): boolean {
  return isRevoked(readTrust(), pub);
}

export function devicePin(pub: string): Bytes | null {
  const pin = trusted().find((d) => d.pub === pub)?.pin;
  if (typeof pin !== 'string') return null;
  try { const b = fromB64(pin); return b.length === 32 ? b : null; } catch { return null; }
}

// Only for a device that is still enrolled: a pin written after a revoke must
// not bring the entry back.
export function setDevicePin(pub: string, pin: Bytes): boolean {
  if (pin.length !== 32) return false;
  return withFileLockSync(DEVICES(), () => {
    const t = writableTrust();
    const i = t.devices.findIndex((d) => d.pub === pub);
    if (i < 0) return false;
    t.devices[i] = { ...t.devices[i], pin: toB64(pin) };
    writeTrust(t.devices, t.revoked);
    return true;
  }, mustLock);
}

// The CLI and the running agent are two processes writing the same file. The
// tombstone goes in the same write as the removal.
export function revokeDevice(pub: string, now = Date.now()): boolean {
  return withFileLockSync(DEVICES(), () => {
    const t = writableTrust();
    const left = t.devices.filter((d) => d.pub !== pub);
    if (left.length === t.devices.length) return false;
    writeTrust(left, [...t.revoked.filter((r) => r.revoked !== pub), { revoked: pub, at: new Date(now).toISOString() }]);
    return true;
  }, mustLock);
}

export function touchDevice(pub: string, now = new Date()): void {
  withFileLockSync(SEEN(), () => writeJson(SEEN(), { ...readJson<Record<string, string>>(SEEN(), {}), [pub]: now.toISOString() }));
}

function livePending(now: number): PendingCode[] {
  return readJson<PendingCode[]>(CODES(), []).filter((c) => typeof c?.secret === 'string' && c.expiresAt > now);
}

export function hasLivePreauth(now = Date.now()): boolean {
  return livePreauth(now).length > 0;
}

function livePreauth(now: number): PendingPreauth[] {
  const all = readJson<PendingPreauth[]>(PREAUTH(), []);
  return Array.isArray(all) ? all.filter((c) => typeof c?.secret === 'string' && typeof c.fp === 'string' && c.expiresAt > now) : [];
}

export async function createEnrollCode(agentPub: Bytes, now = Date.now()): Promise<{ code: string; expiresAt: number }> {
  const { code, secret } = await newEnrollCode(agentPub);
  const expiresAt = now + ENROLL_TTL_MS;
  withFileLockSync(CODES(), () => writeJson(CODES(), [...livePending(now).slice(-(MAX_PENDING - 1)), { secret: toB64(secret), expiresAt }]));
  return { code, expiresAt };
}

// `--pair` with DECK_DEVICE_CODE: the device that showed the setup command may
// enroll itself once, within the same window as an enroll code.
export function storePreauth(code: string, now = Date.now()): number {
  const { deviceFp, secret } = parseDeviceCode(code);
  const expiresAt = now + ENROLL_TTL_MS;
  withFileLockSync(PREAUTH(), () => writeJson(PREAUTH(), [
    ...livePreauth(now).slice(-(MAX_PENDING - 1)),
    { fp: toB64(deviceFp), secret: toB64(secret), expiresAt },
  ]), mustLock);
  return expiresAt;
}

// Single use: redemptions run one at a time and the matching code is burnt
// before the device is written, so two racing requests cannot both enroll.
let redeeming: Promise<unknown> = Promise.resolve();

function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = redeeming.then(fn);
  redeeming = run.catch(() => {});
  return run;
}

export function redeemEnrollCode(
  agentPub: Bytes, devicePub: Bytes, label: string, mac: Bytes, now = Date.now(),
): Promise<Bytes | null> {
  return serialized(() => redeemNow(agentPub, devicePub, label, mac, now));
}

export function redeemPreauth(devicePub: Bytes, label: string, boxId: string, mac: Bytes, now = Date.now()): Promise<Bytes | null> {
  return serialized(() => redeemPreauthNow(devicePub, label, boxId, mac, now));
}

async function redeemNow(agentPub: Bytes, devicePub: Bytes, label: string, mac: Bytes, now: number): Promise<Bytes | null> {
  let match: string | null = null;
  for (const p of livePending(now)) {
    if (await checkRequest(fromB64(p.secret), agentPub, devicePub, label, mac)) { match = p.secret; break; }
  }
  if (!match) return null;
  const secret = match;
  // Burn under the lock and only if the code is still there: another process
  // (or a code expiry) may have consumed it while the MAC was being checked.
  const burnt = withFileLockSync(CODES(), () => {
    const left = livePending(now);
    if (!left.some((p) => p.secret === secret)) return false;
    writeJson(CODES(), left.filter((p) => p.secret !== secret));
    return true;
  }, mustLock);
  if (!burnt) return null;
  trust(devicePub, label, now);
  return fromB64(secret);
}

async function redeemPreauthNow(devicePub: Bytes, label: string, boxId: string, mac: Bytes, now: number): Promise<Bytes | null> {
  let match: string | null = null;
  for (const p of livePreauth(now)) {
    if (await checkPreauthRequest({ deviceFp: fromB64(p.fp), secret: fromB64(p.secret) }, devicePub, label, boxId, mac)) { match = p.secret; break; }
  }
  if (!match) return null;
  const secret = match;
  const pub = toB64(devicePub);
  const use = withFileLockSync(PREAUTH(), (): 'first' | 'again' | null => {
    const left = livePreauth(now);
    const entry = left.find((p) => p.secret === secret);
    if (!entry || (entry.usedBy && entry.usedBy !== pub)) return null;
    if (entry.usedBy) return 'again';
    writeJson(PREAUTH(), left.map((p) => (p === entry ? { ...p, usedBy: pub } : p)));
    return 'first';
  }, mustLock);
  if (!use) return null;
  // A repeat only re-sends the grant: a device revoked since is not brought back.
  if (use === 'again') return isEnrolled(pub) ? fromB64(secret) : null;
  trust(devicePub, label, now);
  return fromB64(secret);
}

// Trust on first use: writes the device only while the list is empty, under the
// same lock as every other write, so of two racing devices only one gets in.
export function trustFirstDevice(devicePub: Bytes, label: string, now = Date.now()): boolean {
  const pub = toB64(devicePub);
  return withFileLockSync(DEVICES(), () => {
    const t = readTrust();
    if (!t.ok || t.devices.length > 0 || isRevoked(t, pub)) return false;
    writeTrust([{ pub, label: cleanLabel(label), addedAt: new Date(now).toISOString() }], t.revoked);
    return true;
  }, mustLock);
}

export function trustAccountDevice(devicePub: Bytes, label: string, now = Date.now()): boolean {
  const pub = toB64(devicePub);
  return withFileLockSync(DEVICES(), () => {
    const t = readTrust();
    if (!t.ok || isRevoked(t, pub)) return false;
    if (t.devices.some((d) => d.pub === pub)) return true;
    writeTrust([...t.devices, { pub, label: cleanLabel(label), addedAt: new Date(now).toISOString() }], t.revoked);
    return true;
  }, mustLock);
}

// An enrolled device vouches for this browser's passkey key from inside its
// sealed channel, handing over the key's pin key for this box in the same write.
export function addPasskeyDevice(devicePub: Bytes, label: string, pin: Bytes, now = Date.now()): boolean {
  if (devicePub.length !== 32 || pin.length !== 32) return false;
  const pub = toB64(devicePub);
  return withFileLockSync(DEVICES(), () => {
    const t = writableTrust();
    if (isRevoked(t, pub)) return false;
    const prev = t.devices.find((d) => d.pub === pub);
    const entry: Device = { pub, label: cleanLabel(label), addedAt: prev?.addedAt ?? new Date(now).toISOString(), pin: toB64(pin) };
    writeTrust([...t.devices.filter((d) => d.pub !== pub), entry], t.revoked);
    return true;
  }, mustLock);
}

// Re-enrolling the same key keeps its pin key: the device holds the same one.
// An explicit code or preauth is the one path that clears a revoked key's tombstone.
function trust(devicePub: Bytes, label: string, now: number): void {
  const pub = toB64(devicePub);
  withFileLockSync(DEVICES(), () => {
    const t = writableTrust();
    const pin = t.devices.find((d) => d.pub === pub)?.pin;
    const entry: Device = { pub, label: cleanLabel(label), addedAt: new Date(now).toISOString(), ...(pin ? { pin } : {}) };
    writeTrust([...t.devices.filter((d) => d.pub !== pub), entry], t.revoked.filter((r) => r.revoked !== pub));
  }, mustLock);
}

export function cleanLabel(label: string): string {
  return label.replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '').trim().slice(0, 60) || 'device';
}
