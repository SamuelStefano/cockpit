import { equalBytes, fromB64, toB64, type Bytes } from './bytes';
import {
  SealedChannel, newEphemeral, newNonce, signTranscript, verifyTranscript, type Ephemeral, type Transcript,
} from './channel';
import { checkGrant, checkPreauthGrant, parseEnrollCode, preauthMac, requestMac, type EnrollCode } from './enroll';

// Browser side of the handshake, kept free of DOM and storage so the agent
// tests can drive a real device against a real hub.

export interface DeviceKeys { pub: Bytes; sign: CryptoKey }

// Lets a device with no pin for this box accept an agent key the agent proved
// with the box's pin key (passkey.ts). Called with the key straight from the
// relay; the answer must come from a secret the relay never held.
export type PinCheck = (agentPub: Bytes, proof: Bytes) => Promise<boolean>;

function field(v: unknown, len: number): Bytes | null {
  if (typeof v !== 'string') return null;
  try { const b = fromB64(v); return b.length === len ? b : null; } catch { return null; }
}

export interface Accepted {
  confirm: Record<string, unknown>;
  channel: SealedChannel;
  agentPub: Bytes;
  // True when the agent key was accepted by its pin proof, not a stored pin.
  provedByPin: boolean;
  // Whether the agent sent a proof that checks out: without one it has no pin
  // key for this device yet, and the device should hand it one.
  hasPin: boolean;
}

export class DeviceHandshake {
  private eph: Ephemeral | null = null;
  private nB: Bytes | null = null;

  constructor(
    private readonly keys: DeviceKeys,
    private readonly pinned: Bytes[],
    private readonly pinCheck: PinCheck | null = null,
  ) {}

  async hello(): Promise<Record<string, unknown>> {
    this.eph = await newEphemeral();
    this.nB = newNonce();
    return { t: 'e2e-hello', dev: toB64(this.keys.pub), eB: toB64(this.eph.pub), nB: toB64(this.nB) };
  }

  // The agent key must be one this device pinned at enrollment, or one the
  // agent proved with this box's pin key. Whatever key the relay puts in the
  // frame is only ever compared or checked, never trusted.
  async accept(m: Record<string, unknown>): Promise<Accepted> {
    if (!this.eph || !this.nB) throw new Error('no hello in flight');
    const agentPub = field(m.agent, 32), eA = field(m.eA, 32), nA = field(m.nA, 16), sig = field(m.sig, 64);
    if (!agentPub || !eA || !nA || !sig) throw new Error('malformed accept');
    const proof = field(m.pin, 32);
    const hasPin = !!proof && !!this.pinCheck && (await this.pinCheck(agentPub, proof));
    const isPinned = this.pinned.some((p) => equalBytes(p, agentPub));
    if (!isPinned && !hasPin) throw new Error('agent key not pinned on this device');
    const t: Transcript = { devicePub: this.keys.pub, agentPub, eB: this.eph.pub, nB: this.nB, eA, nA };
    if (!(await verifyTranscript('agent', agentPub, sig, t))) throw new Error('agent signature rejected');
    const mine = await signTranscript('device', this.keys.sign, t);
    const channel = await SealedChannel.derive('device', this.eph, eA, t);
    this.eph = null;
    return { confirm: { t: 'e2e-confirm', sig: toB64(mine) }, channel, agentPub, provedByPin: !isPinned, hasPin };
  }
}

export async function enrollRequest(code: string, devicePub: Bytes, label: string): Promise<{ frame: Record<string, unknown>; parsed: EnrollCode }> {
  const parsed = parseEnrollCode(code);
  const mac = await requestMac(parsed.secret, devicePub, parsed.agentFp, label);
  return { parsed, frame: { t: 'e2e-enroll', dev: toB64(devicePub), label, mac: toB64(mac) } };
}

// Returns the agent key to pin, or null when the answer did not prove it knew
// the code's secret and matched the code's fingerprint.
export async function enrollResult(m: Record<string, unknown>, parsed: EnrollCode, devicePub: Bytes): Promise<Bytes | null> {
  if (m.t !== 'e2e-enrolled') return null;
  const agentPub = field(m.agent, 32), mac = field(m.mac, 32);
  if (!agentPub || !mac) return null;
  return (await checkGrant(parsed, agentPub, devicePub, mac)) ? agentPub : null;
}

export async function preauthRequest(secret: Bytes, devicePub: Bytes, label: string): Promise<Record<string, unknown>> {
  return { t: 'e2e-preauth', dev: toB64(devicePub), label, mac: toB64(await preauthMac(secret, devicePub, label)) };
}

export async function preauthResult(m: Record<string, unknown>, secret: Bytes, devicePub: Bytes): Promise<Bytes | null> {
  if (m.t !== 'e2e-preauthed') return null;
  const agentPub = field(m.agent, 32), mac = field(m.mac, 32);
  if (!agentPub || !mac) return null;
  return (await checkPreauthGrant(secret, agentPub, devicePub, mac)) ? agentPub : null;
}
