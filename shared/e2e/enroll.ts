import { concat, equalBytes, framed, fromB32, randomBytes, toB32, utf8 } from './bytes';
import { PROTO, fingerprint } from './channel';

// Enrolling a device pins two keys at once, without trusting the relay:
// the code is shown on the agent's own terminal (or handed to an already-
// enrolled device over its sealed channel) and typed into the new browser. It carries the agent's fingerprint
// and a one-time secret. The secret MACs both directions, so a relay in the
// middle can neither swap the device key nor answer with its own agent key.

const FP_LEN = 16;
const SECRET_LEN = 16;
export const ENROLL_TTL_MS = 10 * 60_000;

export interface EnrollCode { agentFp: Uint8Array; secret: Uint8Array }

export async function newEnrollCode(agentPub: Uint8Array): Promise<{ code: string; secret: Uint8Array }> {
  const secret = randomBytes(SECRET_LEN);
  const raw = toB32(concat(await fingerprint(agentPub), secret));
  return { code: raw.match(/.{1,4}/g)!.join('-'), secret };
}

export function parseEnrollCode(code: string): EnrollCode {
  const b = fromB32(code);
  if (b.length !== FP_LEN + SECRET_LEN) throw new Error('invalid enrollment code');
  return { agentFp: b.slice(0, FP_LEN), secret: b.slice(FP_LEN) };
}

async function hmac(secret: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
}

function requestBytes(devicePub: Uint8Array, agentFp: Uint8Array, label: string): Uint8Array {
  return framed(utf8(PROTO), utf8('enroll-request'), devicePub, agentFp, utf8(label));
}

function grantBytes(agentPub: Uint8Array, devicePub: Uint8Array): Uint8Array {
  return framed(utf8(PROTO), utf8('enroll-grant'), agentPub, devicePub);
}

export function requestMac(secret: Uint8Array, devicePub: Uint8Array, agentFp: Uint8Array, label: string): Promise<Uint8Array> {
  return hmac(secret, requestBytes(devicePub, agentFp, label));
}

export function grantMac(secret: Uint8Array, agentPub: Uint8Array, devicePub: Uint8Array): Promise<Uint8Array> {
  return hmac(secret, grantBytes(agentPub, devicePub));
}

export async function checkRequest(secret: Uint8Array, agentPub: Uint8Array, devicePub: Uint8Array, label: string, mac: Uint8Array): Promise<boolean> {
  if (devicePub.length !== 32) return false;
  return equalBytes(mac, await requestMac(secret, devicePub, await fingerprint(agentPub), label));
}

// Device side: the agent key that came back through the relay is accepted only
// if it hashes to the fingerprint from the code AND the grant MAC checks out.
export async function checkGrant(code: EnrollCode, agentPub: Uint8Array, devicePub: Uint8Array, mac: Uint8Array): Promise<boolean> {
  if (agentPub.length !== 32) return false;
  if (!equalBytes(await fingerprint(agentPub), code.agentFp)) return false;
  return equalBytes(mac, await grantMac(code.secret, agentPub, devicePub));
}
