import { equalBytes, fromB64, toB64, type Bytes } from './bytes';
import {
  SealedChannel, newEphemeral, newNonce, signTranscript, verifyTranscript, type Ephemeral, type Transcript,
} from './channel';
import { checkGrant, parseEnrollCode, requestMac, type EnrollCode } from './enroll';

// Browser side of the handshake, kept free of DOM and storage so the agent
// tests can drive a real device against a real hub.

export interface DeviceKeys { pub: Bytes; sign: CryptoKey }

function field(v: unknown, len: number): Bytes | null {
  if (typeof v !== 'string') return null;
  try { const b = fromB64(v); return b.length === len ? b : null; } catch { return null; }
}

export class DeviceHandshake {
  private eph: Ephemeral | null = null;
  private nB: Bytes | null = null;

  constructor(private readonly keys: DeviceKeys, private readonly pinned: Bytes[]) {}

  async hello(): Promise<Record<string, unknown>> {
    this.eph = await newEphemeral();
    this.nB = newNonce();
    return { t: 'e2e-hello', dev: toB64(this.keys.pub), eB: toB64(this.eph.pub), nB: toB64(this.nB) };
  }

  // The agent key must be one this device pinned at enrollment. Whatever key
  // the relay puts in the frame is only ever compared, never trusted.
  async accept(m: Record<string, unknown>): Promise<{ confirm: Record<string, unknown>; channel: SealedChannel; agentPub: Bytes }> {
    if (!this.eph || !this.nB) throw new Error('no hello in flight');
    const agentPub = field(m.agent, 32), eA = field(m.eA, 32), nA = field(m.nA, 16), sig = field(m.sig, 64);
    if (!agentPub || !eA || !nA || !sig) throw new Error('malformed accept');
    if (!this.pinned.some((p) => equalBytes(p, agentPub))) throw new Error('agent key not pinned on this device');
    const t: Transcript = { devicePub: this.keys.pub, agentPub, eB: this.eph.pub, nB: this.nB, eA, nA };
    if (!(await verifyTranscript('agent', agentPub, sig, t))) throw new Error('agent signature rejected');
    const mine = await signTranscript('device', this.keys.sign, t);
    const channel = await SealedChannel.derive('device', this.eph, eA, t);
    this.eph = null;
    return { confirm: { t: 'e2e-confirm', sig: toB64(mine) }, channel, agentPub };
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
