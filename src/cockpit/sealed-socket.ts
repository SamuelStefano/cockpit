import {
  AgentKeyError, DeviceHandshake, enrollRequest, enrollResult, preauthRequest, preauthResult, type DeviceKeys, type PinCheck,
} from '../../shared/e2e/device';
import type { SealedChannel } from '../../shared/e2e/channel';
import type { EnrollCode } from '../../shared/e2e/enroll';
import { boxPinKey, checkPinProof } from '../../shared/e2e/passkey';
import { equalBytes, toB64, type Bytes } from '../../shared/e2e/bytes';
import {
  deviceKeysFor, markPasskeyBox, pinAgent, pinAgentIfEmpty, pinnedAgents, type PasskeyRef,
} from './device-store';
import { dropPreauth, pendingPreauths } from './preauth-store';
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

// After this browser adopted a passkey key: dial again with it, or, on a channel
// that is already open with the random key, hand the box the passkey key.
export function retrySeal(): void {
  mainSocket?.retry();
  void mainSocket?.offerPasskey();
}

// Device management frames (devices list, revoke) ride the main sealed channel
// and never reach the app's message handler.
export type DeviceFrame = Record<string, unknown> & { t: string };
const deviceListeners = new Set<(m: DeviceFrame) => void>();

export const deviceFrames = {
  subscribe: (fn: (m: DeviceFrame) => void) => { deviceListeners.add(fn); return () => { deviceListeners.delete(fn); }; },
  send: (frame: DeviceFrame): boolean => {
    if (!mainSocket || mainSocket.sealed !== 'sealed') return false;
    mainSocket.send(JSON.stringify(frame));
    return true;
  },
};

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
// While a pre-authorization secret is pending, a failed or unanswered attempt is
// tried again: a relay that drops or forges one answer only delays it.
const PREAUTH_RETRY_MS = 2_000;
const PIN_RETRY_MS = 1_000;
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
  private enrolling: { parsed: EnrollCode; replace: boolean; resolve: () => void; reject: (e: Error) => void } | null = null;
  private preauthing: { secret: Bytes; rest: Bytes[] } | null = null;
  private redeemed: Bytes | null = null;
  private starting = false;
  private keys: DeviceKeys | null = null;
  // `passkey`: the key in use is the passkey key. `upgrade`: this browser has a
  // passkey key the box does not know yet, and the channel is on the random key.
  private passkey: PasskeyRef | null = null;
  private upgrade: PasskeyRef | null = null;
  private agentPub: Bytes | null = null;
  private pinRetried = false;
  private readonly box: string | undefined;
  private readonly main: boolean;
  private seal: SealState = 'connecting';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private closed = false;

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
    const keys = this.keys ?? (await deviceKeysFor(this.box)).keys;
    const { frame, parsed } = await enrollRequest(code, keys.pub, label);
    // Only the screen that said this box's key changed may replace its pin.
    const replace = (this.main ? state : this.seal) === 'rejected';
    return new Promise((resolve, reject) => {
      this.enrolling = { parsed, replace, resolve, reject };
      this.raw(JSON.stringify(frame));
    });
  }

  private raw(s: string): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(s);
  }

  retry(): void {
    if (!this.channel && !this.handshake && !this.starting && !this.enrolling && !this.preauthing && this.ws.readyState === WebSocket.OPEN) void this.start();
  }

  private async start(): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    try { await this.begin(); } catch { this.setSeal('enroll'); } finally { this.starting = false; }
  }

  // A socket bound to a box with no pin, holding a passkey key and a secret from
  // a setup command, redeems it before anything else. Nothing else sends
  // e2e-preauth: a relay's "unknown device" never triggers it.
  private async begin(): Promise<void> {
    const pins = await pinnedAgents(this.box);
    const sel = await deviceKeysFor(this.box);
    this.keys = sel.keys; this.passkey = sel.passkey; this.upgrade = sel.upgrade;
    if (this.box !== undefined && !pins.length && this.passkey) {
      const secrets = pendingPreauths();
      if (secrets.length) { await this.preauth(secrets); return; }
    }
    await this.hello(pins);
  }

  // A passkey device with no pin for this box may still accept the agent by its
  // pin proof, which is bound to the box id this socket dialed; any device with
  // no pin for it may accept a box trusting its first device. An unbound socket
  // has no box id to check against: a passkey one waits for the `boxes` frame
  // to bind the dial (the key={box} remount) and only then handshakes.
  private async hello(pins: Bytes[]): Promise<void> {
    const bound = this.box !== undefined;
    if (!pins.length && !bound) {
      if (!this.passkey) { this.setSeal('enroll'); return; }
      this.clearTimer();
      this.timer = setTimeout(() => { if (!this.channel) this.setSeal('enroll'); }, HANDSHAKE_MS);
      return;
    }
    const keys = this.keys!;
    const check = this.passkey && bound ? pinChecker(this.passkey.pinRoot, this.box!, keys.pub) : null;
    this.handshake = new DeviceHandshake(keys, pins, check, { tofu: bound && !pins.length, label: defaultDeviceLabel() });
    this.raw(JSON.stringify(await this.handshake.hello()));
    this.clearTimer();
    this.timer = setTimeout(() => { if (!this.channel) this.fail('handshake timeout', 'unsupported'); }, HANDSHAKE_MS);
  }

  private async preauth(secrets: Bytes[]): Promise<void> {
    const [secret, ...rest] = secrets;
    this.preauthing = { secret, rest };
    this.raw(JSON.stringify(await preauthRequest(secret, this.keys!.pub, defaultDeviceLabel(), this.box!)));
    this.clearTimer();
    this.timer = setTimeout(() => this.enqueue(() => this.preauthNext()), HANDSHAKE_MS);
  }

  // A failed, forged or lost answer moves on to the next secret, then to a plain
  // hello; nothing here is sticky while a secret is still pending.
  private async preauthNext(): Promise<void> {
    const p = this.preauthing;
    if (!p) return;
    this.clearTimer();
    if (p.rest.length) { await this.preauth(p.rest); return; }
    this.preauthing = null;
    await this.hello(await pinnedAgents(this.box));
  }

  // Timers run their step on the frame chain, so it never interleaves with one.
  private enqueue(fn: () => Promise<void>): void {
    this.chain = this.chain.then(fn).catch(() => this.fail('sealed frame rejected'));
  }

  private toEnroll(): void {
    this.setSeal('enroll');
    if (this.box === undefined || !this.passkey || !pendingPreauths().length) return;
    this.clearTimer();
    this.timer = setTimeout(() => this.retry(), PREAUTH_RETRY_MS);
  }

  // Sealed, so the relay never sees the key. Sent only for the box this socket
  // is bound to, and only while that box's slot holds exactly the agent key this
  // channel was opened with; the agent also refuses a key named for another box.
  private async handPin(): Promise<void> {
    const box = this.box, pk = this.passkey, agent = this.agentPub;
    if (box === undefined || !pk || !agent) return;
    const slot = await pinnedAgents(box);
    if (slot.length !== 1 || !equalBytes(slot[0], agent)) return;
    const key = await boxPinKey(pk.pinRoot, box);
    try { this.send(JSON.stringify({ t: 'device-pin', box, key: toB64(key) })); } finally { key.fill(0); }
  }

  // A browser enrolled with its random key vouches for its passkey key from
  // inside the channel; the box trusts it with its pin key in the same write.
  async offerPasskey(): Promise<void> {
    if (!this.channel || this.box === undefined) return;
    if (!this.upgrade) this.upgrade = (await deviceKeysFor(this.box)).upgrade;
    const up = this.upgrade;
    if (!up) return;
    const key = await boxPinKey(up.pinRoot, this.box);
    try {
      this.send(JSON.stringify({ t: 'device-add-passkey', pub: toB64(up.pub), label: defaultDeviceLabel(), box: this.box, key: toB64(key) }));
    } finally { key.fill(0); }
  }

  private async onDeviceFrame(m: DeviceFrame): Promise<void> {
    if (m.t === 'device-passkey-added' && m.ok === true) {
      this.upgrade = null;
      await markPasskeyBox(this.box);
    }
    // A busy device list on the box: one more try, the channel stays up.
    if (m.t === 'device-pinned' && m.ok !== true && m.busy === true && !this.pinRetried) {
      this.pinRetried = true;
      setTimeout(() => this.enqueue(() => this.handPin()), PIN_RETRY_MS);
    }
    for (const fn of deviceListeners) fn(m);
  }

  private async onFrame(s: string): Promise<void> {
    if (this.closed) return;
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
      // The relay announces agent-online right after connect, while the hello
      // sent on open is still in flight: a second hello would make the first
      // accept arrive against the wrong handshake and read as a refused key.
      if (t === 'agent-offline' && this.handshake) { this.handshake = null; this.clearTimer(); }
      if (t === 'agent-online' && !this.channel && !this.handshake && !this.starting && !this.enrolling && !this.preauthing && this.seal !== 'enroll') void this.start();
      this.deliver(s);
      return;
    }
    switch (t) {
      case 'e2e': {
        if (!this.channel) return;
        const text = await this.channel.open(m as { s: unknown; d: unknown });
        if (text.startsWith('{"t":"device')) {
          let f: DeviceFrame | null = null;
          try { f = JSON.parse(text) as DeviceFrame; } catch { /* not a device frame after all */ }
          if (f) { await this.onDeviceFrame(f); return; }
        }
        this.deliver(text);
        return;
      }
      case 'e2e-accept': return this.onAccept(m);
      // Only an answer to this socket's own hello; it never starts a pre-authorization.
      case 'e2e-unknown-device': {
        if (!this.handshake) return;
        this.handshake = null;
        this.clearTimer();
        this.toEnroll();
        return;
      }
      case 'e2e-preauthed':
      case 'e2e-preauth-failed': {
        const pending = this.preauthing;
        if (!pending) return;
        this.clearTimer();
        const pub = await preauthResult(m, pending.secret, this.keys!.pub, this.box!);
        if (!pub) { await this.preauthNext(); return; }
        this.preauthing = null;
        // Kept until the channel seals: if it does not, the box answers the same
        // secret again for this device until it expires.
        this.redeemed = pending.secret;
        await pinAgentIfEmpty(pub, this.box);
        await this.hello(await pinnedAgents(this.box));
        return;
      }
      case 'e2e-enrolled':
      case 'e2e-enroll-failed': {
        const pending = this.enrolling;
        if (!pending) return;
        this.enrolling = null;
        const r = await enrollResult(m, pending.parsed, this.keys?.pub ?? (await deviceKeysFor(this.box)).keys.pub);
        // The grant names the box that answered: a dial the relay sent to
        // another box never pins that box's key under this one.
        const ok = !!r && (this.box === undefined || r.box === this.box.toLowerCase());
        const pinned = ok && (pending.replace ? (await pinAgent(r!.agentPub, this.box), true) : await pinAgentIfEmpty(r!.agentPub, this.box));
        if (!pinned) {
          this.setSeal('enroll-failed');
          pending.reject(new Error(ok ? 'este aparelho já confia em outra chave para esta VPS' : 'código inválido, expirado ou adulterado'));
          return;
        }
        pending.resolve();
        void this.start();
        return;
      }
      case 'e2e-reset': this.fail('agent reset the channel'); return;
    }
  }

  private async onAccept(m: Record<string, unknown>): Promise<void> {
    const hs = this.handshake;
    if (!hs) return;
    this.handshake = null;
    let done;
    try { done = await hs.accept(m); } catch (e) {
      // Nothing to check the key against is not an alarm: back to enrollment
      // (and to the pending pre-authorization, if any), never the sticky refusal.
      if (e instanceof AgentKeyError && e.kind === 'unverified') { this.clearTimer(); this.toEnroll(); return; }
      // A key this device never pinned is either a relay in the middle or a
      // reinstalled agent: both need a fresh enrollment, never a silent retry.
      this.fail('agent key not trusted', 'rejected');
      return;
    }
    if (done.newPin && !(await pinAgentIfEmpty(done.agentPub, this.box))) { this.fail('agent key not trusted', 'rejected'); return; }
    this.raw(JSON.stringify(done.confirm));
    this.channel = done.channel;
    this.agentPub = done.agentPub;
    this.clearTimer();
    this.timer = setTimeout(() => this.fail('channel lifetime reached'), MAX_CHANNEL_MS);
    this.readyState = 1;
    this.setSeal('sealed');
    if (done.tofu) toast('Este aparelho foi cadastrado na VPS na primeira conexão.', { tone: 'ok' });
    if (this.redeemed) { dropPreauth(this.redeemed); this.redeemed = null; }
    if (this.passkey) await markPasskeyBox(this.box);
    this.onopen?.(new Event('open'));
    if (this.passkey && !done.hasPin) await this.handPin();
    if (this.upgrade) await this.offerPasskey();
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
    this.closed = true;
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
