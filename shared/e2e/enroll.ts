import { concat, equalBytes, framed, fromB32, randomBytes, toB32, utf8, type Bytes } from './bytes';
import { PROTO, fingerprint } from './channel';

// Enrolling a device pins two keys at once, without trusting the relay:
// the code is shown on the agent's own terminal (or handed to an already-
// enrolled device over its sealed channel) and typed into the new browser. It carries the agent's fingerprint
// and a one-time secret. The secret MACs both directions, so a relay in the
// middle can neither swap the device key nor answer with its own agent key.

const FP_LEN = 16;
const SECRET_LEN = 16;
export const ENROLL_TTL_MS = 10 * 60_000;

export interface EnrollCode { agentFp: Bytes; secret: Bytes }

export async function newEnrollCode(agentPub: Bytes): Promise<{ code: string; secret: Bytes }> {
  const secret = randomBytes(SECRET_LEN);
  const raw = toB32(concat(await fingerprint(agentPub), secret));
  return { code: raw.match(/.{1,4}/g)!.join('-'), secret };
}

export function parseEnrollCode(code: string): EnrollCode {
  const b = fromB32(code);
  if (b.length !== FP_LEN + SECRET_LEN) throw new Error('invalid enrollment code');
  return { agentFp: b.slice(0, FP_LEN), secret: b.slice(FP_LEN) };
}

export async function hmac(secret: Bytes, data: Bytes): Promise<Bytes> {
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
}

function requestBytes(devicePub: Bytes, agentFp: Bytes, label: string): Bytes {
  return framed(utf8(PROTO), utf8('enroll-request'), devicePub, agentFp, utf8(label));
}

// The box id is in every grant: a box the relay dialed in place of another one
// answers with its own id, and the browser pins only the box it asked for.
const boxBytes = (boxId: string) => utf8(boxId.toLowerCase());

function grantBytes(agentPub: Bytes, devicePub: Bytes, boxId: string): Bytes {
  return framed(utf8(PROTO), utf8('enroll-grant'), agentPub, devicePub, boxBytes(boxId));
}

export function requestMac(secret: Bytes, devicePub: Bytes, agentFp: Bytes, label: string): Promise<Bytes> {
  return hmac(secret, requestBytes(devicePub, agentFp, label));
}

export function grantMac(secret: Bytes, agentPub: Bytes, devicePub: Bytes, boxId: string): Promise<Bytes> {
  return hmac(secret, grantBytes(agentPub, devicePub, boxId));
}

export async function checkRequest(secret: Bytes, agentPub: Bytes, devicePub: Bytes, label: string, mac: Bytes): Promise<boolean> {
  if (devicePub.length !== 32) return false;
  return equalBytes(mac, await requestMac(secret, devicePub, await fingerprint(agentPub), label));
}

// Device side: the agent key that came back through the relay is accepted only
// if it hashes to the fingerprint from the code AND the grant MAC checks out.
export async function checkGrant(code: EnrollCode, agentPub: Bytes, devicePub: Bytes, boxId: string, mac: Bytes): Promise<boolean> {
  if (agentPub.length !== 32) return false;
  if (!equalBytes(await fingerprint(agentPub), code.agentFp)) return false;
  return equalBytes(mac, await grantMac(code.secret, agentPub, devicePub, boxId));
}

// Pre-authorization at pairing (DECK_DEVICE_CODE), the mirror of an enroll
// code: the SPA puts its passkey device key's fingerprint and a one-time secret
// in the setup command it shows, and `--pair` stores both on the box. The
// command goes from the screen to the box's terminal, never through the relay,
// so the secret authenticates the device key to the agent and the agent key back.

export interface DeviceCode { deviceFp: Bytes; secret: Bytes }

export async function newDeviceCode(devicePub: Bytes): Promise<{ code: string; secret: Bytes }> {
  const secret = randomBytes(SECRET_LEN);
  return { code: toB32(concat(await fingerprint(devicePub), secret)), secret };
}

export function parseDeviceCode(code: string): DeviceCode {
  const b = fromB32(code);
  if (b.length !== FP_LEN + SECRET_LEN) throw new Error('invalid device code');
  return { deviceFp: b.slice(0, FP_LEN), secret: b.slice(FP_LEN) };
}

// Both directions name the box: a box the relay routed this dial to by mistake
// refuses the request without burning anything, and its grant never verifies.
export function preauthMac(secret: Bytes, devicePub: Bytes, label: string, boxId: string): Promise<Bytes> {
  return hmac(secret, framed(utf8(PROTO), utf8('preauth-request'), devicePub, utf8(label), boxBytes(boxId)));
}

export function preauthGrantMac(secret: Bytes, agentPub: Bytes, devicePub: Bytes, boxId: string): Promise<Bytes> {
  return hmac(secret, framed(utf8(PROTO), utf8('preauth-grant'), agentPub, devicePub, boxBytes(boxId)));
}

export async function checkPreauthRequest(code: DeviceCode, devicePub: Bytes, label: string, boxId: string, mac: Bytes): Promise<boolean> {
  if (devicePub.length !== 32 || mac.length !== 32) return false;
  if (!equalBytes(await fingerprint(devicePub), code.deviceFp)) return false;
  return equalBytes(mac, await preauthMac(code.secret, devicePub, label, boxId));
}

export async function checkPreauthGrant(secret: Bytes, agentPub: Bytes, devicePub: Bytes, boxId: string, mac: Bytes): Promise<boolean> {
  if (agentPub.length !== 32 || mac.length !== 32) return false;
  return equalBytes(mac, await preauthGrantMac(secret, agentPub, devicePub, boxId));
}
