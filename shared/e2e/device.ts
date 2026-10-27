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
  // True when the agent key was not a stored pin: it came from a pin proof or
  // trust on first use, and the caller pins it (only into an empty slot).
  newPin: boolean;
  // Whether the agent sent a proof that checks out: without one it has no pin
  // key for this device yet, and the device should hand it one.
  hasPin: boolean;
  // Accepted because the box trusts its first device on first use.
  tofu: boolean;
}

// "mismatch": the agent key contradicts what this device pinned or proved, so
// either a relay is in the middle or the agent was reinstalled. "unverified":
// the device has nothing to check the key against yet; not an alarm.
export class AgentKeyError extends Error {
  constructor(message: string, readonly kind: 'mismatch' | 'unverified') { super(message); }
}

export interface HandshakeOptions {
  // Accept an agent that says it trusts this device on first use. Only for a
  // device with no pin for the box it dialed (the agent signs the transcript,
  // not the flag, so a relay can set it).
  tofu?: boolean;
  label?: string;
}

export class DeviceHandshake {
  private eph: Ephemeral | null = null;
  private nB: Bytes | null = null;

  constructor(
    private readonly keys: DeviceKeys,
    private readonly pinned: Bytes[],
    private readonly pinCheck: PinCheck | null = null,
    private readonly opts: HandshakeOptions = {},
  ) {}

  async hello(): Promise<Record<string, unknown>> {
    this.eph = await newEphemeral();
    this.nB = newNonce();
    return {
      t: 'e2e-hello', dev: toB64(this.keys.pub), eB: toB64(this.eph.pub), nB: toB64(this.nB),
      ...(this.opts.label ? { label: this.opts.label } : {}),
    };
  }

  // The agent key must be one this device pinned at enrollment, one the agent
  // proved with this box's pin key, or (device with no pin only) one offered on
  // first use. Whatever key the relay puts in the frame is only ever compared or
  // checked, never trusted.
  async accept(m: Record<string, unknown>): Promise<Accepted> {
    if (!this.eph || !this.nB) throw new Error('no hello in flight');
    const agentPub = field(m.agent, 32), eA = field(m.eA, 32), nA = field(m.nA, 16), sig = field(m.sig, 64);
    if (!agentPub || !eA || !nA || !sig) throw new Error('malformed accept');
    const proof = field(m.pin, 32);
    const hasPin = !!proof && !!this.pinCheck && (await this.pinCheck(agentPub, proof));
    const isPinned = this.pinned.some((p) => equalBytes(p, agentPub));
    const unpinned = this.pinned.length === 0;
    let tofu = false;
    if (!isPinned) {
      // A device that pinned this box keeps refusing any other key.
      if (!unpinned) throw new AgentKeyError('agent key not pinned on this device', 'mismatch');
      if (!hasPin) {
        if (proof && this.pinCheck) throw new AgentKeyError('agent pin proof rejected', 'mismatch');
        if (!(m.tofu === true && this.opts.tofu)) throw new AgentKeyError('agent key unverified', 'unverified');
        tofu = true;
      }
    }
    const t: Transcript = { devicePub: this.keys.pub, agentPub, eB: this.eph.pub, nB: this.nB, eA, nA };
    if (!(await verifyTranscript('agent', agentPub, sig, t))) throw new AgentKeyError('agent signature rejected', 'mismatch');
    const mine = await signTranscript('device', this.keys.sign, t);
    const channel = await SealedChannel.derive('device', this.eph, eA, t);
    this.eph = null;
    return { confirm: { t: 'e2e-confirm', sig: toB64(mine) }, channel, agentPub, newPin: !isPinned, hasPin, tofu };
  }
}

export async function enrollRequest(code: string, devicePub: Bytes, label: string): Promise<{ frame: Record<string, unknown>; parsed: EnrollCode }> {
  const parsed = parseEnrollCode(code);
  const mac = await requestMac(parsed.secret, devicePub, parsed.agentFp, label);
  return { parsed, frame: { t: 'e2e-enroll', dev: toB64(devicePub), label, mac: toB64(mac) } };
}

// Returns the agent key to pin and the box id it signed, or null when the
// answer did not prove it knew the code's secret and matched its fingerprint.
// A socket bound to a box must also check that id against the box it dialed.
export async function enrollResult(m: Record<string, unknown>, parsed: EnrollCode, devicePub: Bytes): Promise<{ agentPub: Bytes; box: string } | null> {
  if (m.t !== 'e2e-enrolled') return null;
  const agentPub = field(m.agent, 32), mac = field(m.mac, 32);
  const box = typeof m.box === 'string' ? m.box.toLowerCase() : '';
  if (!agentPub || !mac) return null;
  return (await checkGrant(parsed, agentPub, devicePub, box, mac)) ? { agentPub, box } : null;
}

export async function preauthRequest(secret: Bytes, devicePub: Bytes, label: string, box: string): Promise<Record<string, unknown>> {
  return { t: 'e2e-preauth', dev: toB64(devicePub), label, mac: toB64(await preauthMac(secret, devicePub, label, box)) };
}

// Only verifies for the box this device asked for (`box`).
export async function preauthResult(m: Record<string, unknown>, secret: Bytes, devicePub: Bytes, box: string): Promise<Bytes | null> {
  if (m.t !== 'e2e-preauthed') return null;
  const agentPub = field(m.agent, 32), mac = field(m.mac, 32);
  if (!agentPub || !mac) return null;
  return (await checkPreauthGrant(secret, agentPub, devicePub, box, mac)) ? agentPub : null;
}
