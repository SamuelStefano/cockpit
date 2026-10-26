import { DeviceHandshake, enrollRequest, enrollResult } from '../../shared/e2e/device';
import type { SealedChannel } from '../../shared/e2e/channel';
import type { EnrollCode } from '../../shared/e2e/enroll';
import { deviceKeys, pinAgent, pinnedAgents } from './device-store';

// Relay-mode socket (T5). Same surface useCockpit uses on a WebSocket, but it
// reports "open" only once a sealed channel to a pinned agent exists, and from
// then on everything app-level goes through that channel. Plaintext from the
// relay is dropped except for the few frames the relay itself owns: a hostile
// relay can stop the Deck, but cannot read it, steer it or speak for the agent.

export type SealState = 'connecting' | 'enroll' | 'enroll-failed' | 'sealed' | 'unsupported' | 'rejected';

let state: SealState = 'connecting';
const listeners = new Set<() => void>();
let current: SealedSocket | null = null;

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
  if (!current) return Promise.reject(new Error('sem conexão com o relay'));
  return current.enroll(code, label);
}

// Frames the relay answers itself (account admin) or emits about the link.
const FROM_RELAY = new Set(['agent-online', 'agent-offline', 'accounts']);
const TO_RELAY = /^\{"t":"(accounts-list|set-admin)"/;
const HANDSHAKE_MS = 10_000;
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
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  // The JWT rides as a subprotocol entry, never in the URL: the relay picks
  // `deck.v1`, and access/error logs that record the URL never see the token.
  constructor(url: string, token: string) {
    current = this;
    // A refused agent key or an agent without T5 stays on screen across the
    // automatic redials; only a sealed channel or a new enrollment clears it.
    if (state !== 'rejected' && state !== 'unsupported') setState('connecting');
    this.ws = token ? new WebSocket(url, ['deck.v1', `bearer.${token}`]) : new WebSocket(url);
    this.ws.onmessage = (ev) => { this.chain = this.chain.then(() => this.onFrame(String(ev.data))).catch(() => this.fail('sealed frame rejected')); };
    this.ws.onclose = (ev) => this.finish(ev.code, ev.reason);
    this.ws.onerror = (ev) => this.onerror?.(ev);
    this.ws.onopen = () => { void this.start(); };
  }

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

  private async start(): Promise<void> {
    const pins = await pinnedAgents();
    if (!pins.length) { setState('enroll'); return; }
    this.handshake = new DeviceHandshake(await deviceKeys(), pins);
    this.raw(JSON.stringify(await this.handshake.hello()));
    this.clearTimer();
    this.timer = setTimeout(() => { if (!this.channel) this.fail('handshake timeout', 'unsupported'); }, HANDSHAKE_MS);
  }

  private async onFrame(s: string): Promise<void> {
    let m: Record<string, unknown>;
    try { m = JSON.parse(s); } catch { return; }
    const t = m.t;
    if (typeof t !== 'string') return;
    if (FROM_RELAY.has(t)) {
      if (t === 'agent-offline' && this.channel) { this.fail('agent went offline'); return; }
      if (t === 'agent-online' && !this.channel && !this.enrolling && state !== 'enroll') void this.start();
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
        this.raw(JSON.stringify(confirm));
        this.channel = channel;
        this.clearTimer();
        this.readyState = 1;
        setState('sealed');
        this.onopen?.(new Event('open'));
        return;
      }
      case 'e2e-unknown-device': this.clearTimer(); setState('enroll'); return;
      case 'e2e-enrolled':
      case 'e2e-enroll-failed': {
        const pending = this.enrolling;
        if (!pending) return;
        this.enrolling = null;
        const pub = await enrollResult(m, pending.parsed, (await deviceKeys()).pub);
        if (!pub) { setState('enroll-failed'); pending.reject(new Error('código inválido, expirado ou adulterado')); return; }
        await pinAgent(pub);
        pending.resolve();
        void this.start();
        return;
      }
      case 'e2e-reset': this.fail('agent reset the channel'); return;
    }
  }

  private deliver(data: string): void {
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  private fail(reason: string, next: SealState = 'connecting'): void {
    setState(next);
    this.close(SEAL_LOST, reason);
  }

  private finish(code: number, reason: string): void {
    this.clearTimer();
    this.channel = null;
    this.readyState = 3;
    if (current === this) current = null;
    this.onclose?.(new CloseEvent('close', { code, reason }));
  }

  private clearTimer(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }
}
