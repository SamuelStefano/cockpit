import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ENROLL_TTL_MS, checkRequest, newEnrollCode } from '../../shared/e2e/enroll';
import { fromB64, toB64, type Bytes } from '../../shared/e2e/bytes';

// Devices allowed to open a sealed channel to this agent. Lives next to the
// agent's private key and is only ever written from this box: from the CLI, or
// by a device that is already enrolled. The relay has no way to add one.

const DIR = () => process.env.DECK_AGENT_DIR || join(homedir(), '.deck-agent');
const DEVICES = () => join(DIR(), 'devices.json');
const CODES = () => join(DIR(), 'enroll-codes.json');
const MAX_PENDING = 5;

export interface Device { pub: string; label: string; addedAt: string; lastSeen?: string }
interface PendingCode { secret: string; expiresAt: number }

function readJson<T>(path: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; } catch { return fallback; }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(DIR(), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(tmp, path);
}

export function listDevices(): Device[] {
  const d = readJson<Device[]>(DEVICES(), []);
  return Array.isArray(d) ? d.filter((x) => typeof x?.pub === 'string') : [];
}

export function isEnrolled(pub: string): boolean {
  return listDevices().some((d) => d.pub === pub);
}

export function revokeDevice(pub: string): boolean {
  const all = listDevices();
  const left = all.filter((d) => d.pub !== pub);
  if (left.length === all.length) return false;
  writeJson(DEVICES(), left);
  return true;
}

export function touchDevice(pub: string, now = new Date()): void {
  const all = listDevices();
  const d = all.find((x) => x.pub === pub);
  if (!d) return;
  d.lastSeen = now.toISOString();
  writeJson(DEVICES(), all);
}

function livePending(now: number): PendingCode[] {
  return readJson<PendingCode[]>(CODES(), []).filter((c) => typeof c?.secret === 'string' && c.expiresAt > now);
}

export async function createEnrollCode(agentPub: Bytes, now = Date.now()): Promise<{ code: string; expiresAt: number }> {
  const { code, secret } = await newEnrollCode(agentPub);
  const expiresAt = now + ENROLL_TTL_MS;
  writeJson(CODES(), [...livePending(now).slice(-(MAX_PENDING - 1)), { secret: toB64(secret), expiresAt }]);
  return { code, expiresAt };
}

// Single use: redemptions run one at a time and the matching code is burnt
// before the device is written, so two racing requests cannot both enroll.
let redeeming: Promise<unknown> = Promise.resolve();

export function redeemEnrollCode(
  agentPub: Bytes, devicePub: Bytes, label: string, mac: Bytes, now = Date.now(),
): Promise<Bytes | null> {
  const run = redeeming.then(() => redeemNow(agentPub, devicePub, label, mac, now));
  redeeming = run.catch(() => {});
  return run;
}

async function redeemNow(agentPub: Bytes, devicePub: Bytes, label: string, mac: Bytes, now: number): Promise<Bytes | null> {
  const pending = livePending(now);
  for (const p of pending) {
    const secret = fromB64(p.secret);
    if (!(await checkRequest(secret, agentPub, devicePub, label, mac))) continue;
    writeJson(CODES(), pending.filter((x) => x !== p));
    const pub = toB64(devicePub);
    const rest = listDevices().filter((d) => d.pub !== pub);
    writeJson(DEVICES(), [...rest, { pub, label: cleanLabel(label), addedAt: new Date(now).toISOString() }]);
    return secret;
  }
  return null;
}

export function cleanLabel(label: string): string {
  return label.replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '').trim().slice(0, 60) || 'device';
}
