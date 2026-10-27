import { DeviceHandshake, enrollRequest, enrollResult, preauthRequest, preauthResult, type PinCheck } from '../../shared/e2e/device';
import type { SealedChannel } from '../../shared/e2e/channel';
import type { EnrollCode } from '../../shared/e2e/enroll';
import { boxPinKey, checkPinProof } from '../../shared/e2e/passkey';
import { toB64, type Bytes } from '../../shared/e2e/bytes';
import { clearPreauth, deviceKeys, passkeyDevice, pendingPreauth, pinAgent, pinnedAgents } from './device-store';
import { defaultDeviceLabel } from './device-label';
import { toast } from '../components/primitives/toast-bus';
import { boxStore } from './boxes-store';

// Relay-mode socket (T5). Same surface useCockpit uses on a WebSocket, but it
// reports "open" only once a sealed channel to a pinned agent exists, and from
// then on everything app-level goes through that channel. Plaintext from the
// relay is dropped except for the few frames the relay itself owns: a hostile
// relay can stop the Deck, but cannot read it, steer it or speak for the agent.

export type SealState = 'connecting' | 'enroll' | 'enroll-failed' | 'sealed' | 'unsupported' | 'rejected';

let state: SealState = 'connecting';
const listeners = new Set<() => void>();
let mainSocket: SealedSocket | null = null;

export const sealState = {
  get: () => state,
  subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
};

function setState(s: SealState): void {
  if (state === s) return;
  state = s;
  for (const fn of listeners) fn();
}

export function enrollThisDevice(code: string, label: string): Promise<void> {
  if (!mainSocket) return Promise.reject(new Error('sem conexão com o relay'));
  return mainSocket.enroll(code, label);
}

// After this browser adopted a passkey key: dial again with it.
export function retrySeal(): void {
  mainSocket?.retry();
}

function pinChecker(pinRoot: CryptoKey, box: string, devicePub: Bytes): PinCheck {
  return async (agentPub, proof) => {
    const key = await boxPinKey(pinRoot, box);
    try { return await checkPinProof(key, proof, agentPub, devicePub, box); } finally { key.fill(0); }
  };
}

// Plaintext admin frame for the relay (rename/revoke a box) over the main socket.
export function sendRelayFrame(frame: { t: 'box-rename'; id: string; label: string } | { t: 'box-revoke'; id: string }): void {
  mainSocket?.send(JSON.stringify(frame));
}

export interface SealedSocketOptions {
  // Box this socket is bound to (`?box=` is already in the url); scopes its pins.
  box?: string;
  // Only the main socket drives the exported sealState and enrollThisDevice.
  main?: boolean;
}

// Frames the relay answers itself (account admin) or emits about the link.
const FROM_RELAY = new Set(['agent-online', 'agent-offline', 'accounts', 'boxes', 'box-error']);
const TO_RELAY = /^\{"t":"(accounts-list|set-admin|box-rename|box-revoke)"/;
const HANDSHAKE_MS = 10_000;
// Mirrors the agent's cap: neither end keeps a channel's keys longer than this.
const MAX_CHANNEL_MS = 12 * 3600_000;
export const SEAL_LOST = 4002;

type Handler<E> = ((ev: E) => void) | null;

export class SealedSocket {
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readyState = 0;
  onopen: Handler<Event> = null;
  onmessage: Handler<MessageEvent> = null;
  onclose: Handler<CloseEvent> = null;
  onerror: Handler<Event> = null;

  private ws: WebSocket;
  private channel: SealedChannel | null = null;
  private handshake: DeviceHandshake | null = null;
  private enrolling: { parsed: EnrollCode; resolve: () => void; reject: (e: Error) => void } | null = null;
  private preauthing: { secret: Bytes } | null = null;
  private passkey: { pub: Bytes; pinRoot: CryptoKey } | null = null;
  private readonly box: string | undefined;
  private readonly main: boolean;
  private seal: SealState = 'connecting';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  // The JWT rides as a subprotocol entry, never in the URL: the relay picks
  // `deck.v1`, and access/error logs that record the URL never see the token.
  constructor(url: string, token: string, opts: SealedSocketOptions = {}) {
    this.box = opts.box;
    this.main = opts.main === true;
    if (this.main) {
      mainSocket = this;
      // A refused agent key or an agent without T5 stays on screen across the
      // automatic redials; only a sealed channel or a new enrollment clears it.
      if (state !== 'rejected' && state !== 'unsupported') setState('connecting');
    }
    this.ws = token ? new WebSocket(url, ['deck.v1', `bearer.${token}`]) : new WebSocket(url);
    this.ws.onmessage = (ev) => { this.chain = this.chain.then(() => this.onFrame(String(ev.data))).catch(() => this.fail('sealed frame rejected')); };
    this.ws.onclose = (ev) => this.finish(ev.code, ev.reason);
    this.ws.onerror = (ev) => this.onerror?.(ev);
    this.ws.onopen = () => { void this.start(); };
  }

  get sealed(): SealState { return this.seal; }

  get bufferedAmount(): number { return this.ws.bufferedAmount; }

  send(data: string): void {
    if (TO_RELAY.test(data.slice(0, 32))) { this.raw(data); return; }
    const ch = this.channel;
    if (this.readyState !== 1 || !ch) return;
    this.chain = this.chain.then(async () => this.raw(JSON.stringify({ t: 'e2e', ...(await ch.seal(data)) })));
  }

  close(code?: number, reason?: string): void {
    this.clearTimer();
    try { this.ws.close(code, reason); } catch { /* already closing */ }
  }

  async enroll(code: string, label: string): Promise<void> {
    const keys = await deviceKeys();
    const { frame, parsed } = await enrollRequest(code, keys.pub, label);
    return new Promise((resolve, reject) => {
      this.enrolling = { parsed, resolve, reject };
      this.raw(JSON.stringify(frame));
    });
  }

  private raw(s: string): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(s);
  }

  retry(): void {
    if (!this.channel && !this.enrolling && !this.preauthing && this.ws.readyState === WebSocket.OPEN) void this.start();
  }

  // A passkey device with no pin for this box may still accept the agent by its
  // pin proof, which is bound to the box id this socket dialed. An unbound
  // socket has no box id to check against: it waits for the `boxes` frame to
  // bind the dial (the key={box} remount) and only then handshakes.
  private async start(): Promise<void> {
    const pins = await pinnedAgents(this.box);
    this.passkey = await passkeyDevice().catch(() => null);
    const viaPin = !!this.passkey && this.box !== undefined;
    if (!pins.length && !viaPin) {
      if (!this.passkey) { this.setSeal('enroll'); return; }
      this.clearTimer();
      this.timer = setTimeout(() => { if (!this.channel) this.setSeal('enroll'); }, HANDSHAKE_MS);
      return;
    }
    const keys = await deviceKeys();
    const check = viaPin ? pinChecker(this.passkey!.pinRoot, this.box!, keys.pub) : null;
    this.handshake = new DeviceHandshake(keys, pins, check);
    this.raw(JSON.stringify(await this.handshake.hello()));
    this.clearTimer();
    this.timer = setTimeout(() => { if (!this.channel) this.fail('handshake timeout', 'unsupported'); }, HANDSHAKE_MS);
  }

  // The pending secret from the setup command (pairing.ts) enrolls this device
  // on the box that `--pair`ed with it. Any other box just answers "failed".
  private async tryPreauth(): Promise<boolean> {
    const secret = await pendingPreauth();
    if (!secret) return false;
    const keys = await deviceKeys();
    this.preauthing = { secret };
    this.raw(JSON.stringify(await preauthRequest(secret, keys.pub, defaultDeviceLabel())));
    this.clearTimer();
    this.timer = setTimeout(() => { if (this.preauthing) { this.preauthing = null; this.setSeal('enroll'); } }, HANDSHAKE_MS);
    return true;
  }

  // Sealed, so the relay never sees the key. Sent only on a socket bound to the
  // box id the key is derived for; the agent also refuses a key named for
  // another box.
  private async handPin(box: string, pinRoot: CryptoKey): Promise<void> {
    const key = await boxPinKey(pinRoot, box);
    try { this.send(JSON.stringify({ t: 'device-pin', box, key: toB64(key) })); } finally { key.fill(0); }
  }

  private async onFrame(s: string): Promise<void> {
    let m: Record<string, unknown>;
    try { m = JSON.parse(s); } catch { return; }
    const t = m.t;
    if (typeof t !== 'string') return;
    if (FROM_RELAY.has(t)) {
      if (t === 'boxes' || t === 'box-error') {
        if (this.main) { if (t === 'boxes') boxStore.applyFrame(m); else boxStore.applyError(m); }
        return;
      }
      if (t === 'agent-offline' && this.channel) { this.fail('agent went offline'); return; }
      if (t === 'agent-online' && !this.channel && !this.enrolling && !this.preauthing && this.seal !== 'enroll') void this.start();
      this.deliver(s);
      return;
    }
    switch (t) {
      case 'e2e': {
        if (!this.channel) return;
        this.deliver(await this.channel.open(m as { s: unknown; d: unknown }));
        return;
      }
      case 'e2e-accept': {
        if (!this.handshake) return;
        // A key this device never pinned is either a relay in the middle or a
        // reinstalled agent: both need a fresh enrollment, never a silent retry.
        const done = await this.handshake.accept(m).catch(() => null);
        this.handshake = null;
        if (!done) { this.fail('agent key not trusted', 'rejected'); return; }
        const { confirm, channel } = done;
        if (done.provedByPin) await pinAgent(done.agentPub, this.box);
        this.raw(JSON.stringify(confirm));
        this.channel = channel;
        this.clearTimer();
        this.timer = setTimeout(() => this.fail('channel lifetime reached'), MAX_CHANNEL_MS);
        this.readyState = 1;
        this.setSeal('sealed');
        this.onopen?.(new Event('open'));
        if (this.passkey && this.box !== undefined && !done.hasPin) await this.handPin(this.box, this.passkey.pinRoot);
        return;
      }
      case 'e2e-unknown-device': {
        this.clearTimer();
        if (this.passkey && !this.preauthing && (await this.tryPreauth())) return;
        this.setSeal('enroll');
        return;
      }
      case 'e2e-preauthed':
      case 'e2e-preauth-failed': {
        const pending = this.preauthing;
        if (!pending) return;
        this.preauthing = null;
        this.clearTimer();
        const pub = await preauthResult(m, pending.secret, (await deviceKeys()).pub);
        if (!pub) { this.setSeal('enroll'); return; }
        await pinAgent(pub, this.box);
        await clearPreauth();
        void this.start();
        return;
      }
      case 'e2e-enrolled':
      case 'e2e-enroll-failed': {
        const pending = this.enrolling;
        if (!pending) return;
        this.enrolling = null;
        const pub = await enrollResult(m, pending.parsed, (await deviceKeys()).pub);
        if (!pub) { this.setSeal('enroll-failed'); pending.reject(new Error('código inválido, expirado ou adulterado')); return; }
        await pinAgent(pub, this.box);
        pending.resolve();
        void this.start();
        return;
      }
      case 'e2e-reset': this.fail('agent reset the channel'); return;
    }
  }

  private setSeal(s: SealState): void {
    this.seal = s;
    if (this.main) setState(s);
  }

  private deliver(data: string): void {
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  // A relay can drop the last thing you sent and then force a reconnect, which
  // starts a fresh channel and hides the loss. Say so instead of reconnecting
  // silently, so an unconfirmed action gets checked.
  private fail(reason: string, next: SealState = 'connecting'): void {
    if (this.channel && reason !== 'channel lifetime reached') {
      toast('Conexão cifrada reiniciada — confira se a última ação chegou.', { tone: 'error' });
    }
    this.setSeal(next);
    this.close(SEAL_LOST, reason);
  }

  private finish(code: number, reason: string): void {
    this.clearTimer();
    this.channel = null;
    this.readyState = 3;
    if (mainSocket === this) mainSocket = null;
    this.onclose?.(new CloseEvent('close', { code, reason }));
  }

  private clearTimer(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }
}
