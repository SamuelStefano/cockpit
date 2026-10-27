import { EventEmitter } from 'node:events';
import { createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, linkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { WebSocket } from 'ws';
import {
  SealedChannel, newEphemeral, newNonce, signTranscript, verifyTranscript, type Ephemeral, type Transcript,
} from '../../shared/e2e/channel';
import { grantMac } from '../../shared/e2e/enroll';
import { fromB64, toB64, type Bytes } from '../../shared/e2e/bytes';
import { isEnrolled, redeemEnrollCode, touchDevice } from './devices';

// One SealedPeer per browser channel. It looks like a WebSocket to
// serveConnection/broadcast, so the agent serves each sealed browser exactly as
// the listen mode serves each local tab. Everything it sends goes out encrypted
// for that one browser; the relay sees only the routing id.

const CONN_ID = /^[A-Za-z0-9_-]{22}$/;
const HANDSHAKE_TTL_MS = 15_000;
const MAX_PENDING = 32;
// A channel lives at most this long, then the browser redials and re-handshakes.
// The sweep also catches a device revoked from the CLI (another process).
export const MAX_CHANNEL_MS = 12 * 3600_000;
const SWEEP_MS = 10_000;
const DROPPABLE = /^\{"t":"(delta|thinking|stats|bgAgents)"/;

export interface AgentKeys { pub: Bytes; sign: CryptoKey }

// The sealed channel has its OWN key, never the one that answers the relay's
// login challenge: the relay picks that challenge, so the same key would let it
// ask for a signature over bytes of its choosing.
export async function loadE2eKeys(): Promise<AgentKeys> {
  const dir = process.env.DECK_AGENT_DIR || join(homedir(), '.deck-agent');
  const file = join(dir, 'e2e-key.json');
  let rec: { privateKeyPem: string; publicKey: string } | null = null;
  try { rec = JSON.parse(readFileSync(file, 'utf8')); } catch { rec = null; }
  if (!rec?.privateKeyPem) {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    rec = {
      privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    };
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    // Written whole to a temp file, then hard-linked into place: link fails if
    // the key already exists, so a racing process (CLI vs agent) never reads a
    // half-written key and the first complete one wins.
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(rec, null, 2), { mode: 0o600 });
    try { linkSync(tmp, file); } catch { rec = JSON.parse(readFileSync(file, 'utf8')); } finally { rmSync(tmp, { force: true }); }
  }
  if (!rec?.privateKeyPem || !rec.publicKey) throw new Error(`${file} exists but holds no key: move it away to create a new one (enrolled devices will need to re-enroll)`);
  return agentKeysFrom(rec!.privateKeyPem, rec!.publicKey);
}

export async function agentKeysFrom(privateKeyPem: string, publicKeySpkiB64: string): Promise<AgentKeys> {
  const der = createPrivateKey(privateKeyPem).export({ type: 'pkcs8', format: 'der' });
  const sign = await crypto.subtle.importKey('pkcs8', new Uint8Array(der), { name: 'Ed25519' }, false, ['sign']);
  const spki = Buffer.from(publicKeySpkiB64, 'base64');
  return { pub: new Uint8Array(spki.subarray(spki.length - 32)), sign };
}

export class SealedPeer extends EventEmitter {
  readonly OPEN = 1;
  readonly openedAt = Date.now();
  readyState = 1;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    readonly connId: string,
    readonly devicePub: string,
    private readonly link: WebSocket,
    private readonly channel: SealedChannel,
    private readonly intercept: (peer: SealedPeer, text: string) => boolean = () => false,
  ) {
    super();
  }

  get bufferedAmount(): number { return this.link.bufferedAmount; }

  // Callers expect a synchronous send; the chain keeps frames in order.
  send(data: string): void {
    if (this.readyState !== 1) return;
    const droppable = DROPPABLE.test(data.slice(0, 24));
    const p = droppable ? 1 : 0;
    this.chain = this.chain.then(async () => {
      const f = await this.channel.seal(String(data), !droppable);
      if (this.readyState !== 1 || this.link.readyState !== this.link.OPEN) return;
      this.link.send(`{"c":"${this.connId}","p":${p},"t":"e2e","s":${f.s},"d":"${f.d}"}`);
    }).catch(() => this.close());
  }

  deliver(frame: { s: unknown; d: unknown }): void {
    this.chain = this.chain.then(async () => {
      const text = await this.channel.open(frame);
      if (this.readyState !== 1 || this.intercept(this, text)) return;
      this.emit('message', Buffer.from(text));
    }).catch(() => this.close(true));
  }

  ping(): void { this.emit('pong'); }

  close(tampered = false): void {
    if (this.readyState !== 1) return;
    this.readyState = 3;
    if (tampered) console.error(`[agent] e2e: frame rejected on channel ${this.connId}; channel closed`);
    try { this.link.send(JSON.stringify({ c: this.connId, t: 'e2e-reset' })); } catch { /* link gone */ }
    this.emit('close', 4002);
  }

  terminate(): void { this.close(); }
}

interface Pending { eph: Ephemeral; t: Transcript; devicePub: string; at: number }

export interface HubOptions {
  keys: AgentKeys;
  link: WebSocket;
  serve: (peer: SealedPeer) => void;
  intercept?: (peer: SealedPeer, text: string) => boolean;
  onPeersChanged: () => void;
}

export class SealedHub {
  readonly peers = new Map<string, SealedPeer>();
  private pending = new Map<string, Pending>();
  private queue = new Map<string, Promise<unknown>>();
  private sweeper: ReturnType<typeof setInterval>;

  constructor(private readonly o: HubOptions) {
    this.sweeper = setInterval(() => this.sweep(), SWEEP_MS);
    this.sweeper.unref?.();
  }

  sweep(now = Date.now()): void {
    for (const p of [...this.peers.values()]) {
      if (now - p.openedAt > MAX_CHANNEL_MS || !isEnrolled(p.devicePub)) p.close();
    }
  }

  // Frames for one connId are handled strictly in order: a confirm and the
  // first sealed frame right behind it must not race.
  handle(raw: string): boolean {
    if (!raw.startsWith('{"t":"e2e')) return false;
    let m: Record<string, unknown>;
    try { m = JSON.parse(raw); } catch { return true; }
    const c = m.c;
    if (typeof c !== 'string' || !CONN_ID.test(c)) return true;
    const prev = this.queue.get(c) ?? Promise.resolve();
    const next = prev.then(() => this.step(c, m)).catch((e) => console.error('[agent] e2e:', (e as Error).message));
    this.queue.set(c, next);
    void next.then(() => { if (this.queue.get(c) === next) this.queue.delete(c); });
    return true;
  }

  private reply(c: string, body: Record<string, unknown>): void {
    try { this.o.link.send(JSON.stringify({ c, ...body })); } catch { /* link gone */ }
  }

  private async step(c: string, m: Record<string, unknown>): Promise<void> {
    switch (m.t) {
      case 'e2e': {
        const peer = this.peers.get(c);
        if (!peer) { this.reply(c, { t: 'e2e-reset' }); return; }
        peer.deliver(m as { s: unknown; d: unknown });
        return;
      }
      case 'e2e-gone': this.drop(c); return;
      case 'e2e-hello': return this.hello(c, m);
      case 'e2e-confirm': return this.confirm(c, m);
      case 'e2e-enroll': return this.enroll(c, m);
    }
  }

  private async hello(c: string, m: Record<string, unknown>): Promise<void> {
    this.drop(c);
    const dev = bytesField(m.dev, 32), eB = bytesField(m.eB, 32), nB = bytesField(m.nB, 16);
    if (!dev || !eB || !nB) return;
    const devicePub = toB64(dev);
    if (!isEnrolled(devicePub)) { this.reply(c, { t: 'e2e-unknown-device' }); return; }
    const eph = await newEphemeral();
    const t: Transcript = { devicePub: dev, agentPub: this.o.keys.pub, eB, nB, eA: eph.pub, nA: newNonce() };
    const sig = await signTranscript('agent', this.o.keys.sign, t);
    this.prunePending();
    this.pending.set(c, { eph, t, devicePub, at: Date.now() });
    this.reply(c, { t: 'e2e-accept', agent: toB64(this.o.keys.pub), eA: toB64(t.eA), nA: toB64(t.nA), sig: toB64(sig) });
  }

  private async confirm(c: string, m: Record<string, unknown>): Promise<void> {
    const p = this.pending.get(c);
    this.pending.delete(c);
    if (!p || Date.now() - p.at > HANDSHAKE_TTL_MS) { this.reply(c, { t: 'e2e-reset' }); return; }
    const sig = bytesField(m.sig, 64);
    // Re-read: a device revoked during the handshake must not get in.
    if (!sig || !isEnrolled(p.devicePub) || !(await verifyTranscript('device', p.t.devicePub, sig, p.t))) {
      console.error(`[agent] e2e: handshake signature rejected on channel ${c}`);
      this.reply(c, { t: 'e2e-reset' });
      return;
    }
    const channel = await SealedChannel.derive('agent', p.eph, p.t.eB, p.t);
    const peer = new SealedPeer(c, p.devicePub, this.o.link, channel, this.o.intercept);
    peer.once('close', () => { if (this.peers.get(c) === peer) { this.peers.delete(c); this.o.onPeersChanged(); } });
    this.peers.set(c, peer);
    touchDevice(p.devicePub);
    this.o.onPeersChanged();
    this.o.serve(peer);
  }

  private async enroll(c: string, m: Record<string, unknown>): Promise<void> {
    const dev = bytesField(m.dev, 32), mac = bytesField(m.mac, 32);
    const label = typeof m.label === 'string' ? m.label.slice(0, 200) : '';
    if (!dev || !mac) return;
    const secret = await redeemEnrollCode(this.o.keys.pub, dev, label, mac);
    if (!secret) { this.reply(c, { t: 'e2e-enroll-failed' }); return; }
    console.error(`[agent] e2e: device enrolled (${toB64(dev).slice(0, 8)}…)`);
    this.reply(c, { t: 'e2e-enrolled', agent: toB64(this.o.keys.pub), mac: toB64(await grantMac(secret, this.o.keys.pub, dev)) });
  }

  // connIds come from the relay, so a hostile one could open handshakes forever.
  private prunePending(): void {
    const now = Date.now();
    for (const [k, v] of this.pending) if (now - v.at > HANDSHAKE_TTL_MS) this.pending.delete(k);
    while (this.pending.size >= MAX_PENDING) this.pending.delete(this.pending.keys().next().value!);
  }

  private drop(c: string): void {
    this.pending.delete(c);
    this.peers.get(c)?.close();
  }

  closeAll(): void {
    clearInterval(this.sweeper);
    for (const p of [...this.peers.values()]) p.close();
    this.pending.clear();
  }

  // A device revoked while connected loses its channel at once.
  dropDevice(devicePub: string): void {
    for (const p of [...this.peers.values()]) if (p.devicePub === devicePub) p.close();
  }
}

function bytesField(v: unknown, len: number): Bytes | null {
  if (typeof v !== 'string') return null;
  try { const b = fromB64(v); return b.length === len ? b : null; } catch { return null; }
}
