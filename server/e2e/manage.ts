import { addPasskeyDevice, createEnrollCode, listDevices, revokeDevice, setDevicePin } from './devices';
import type { SealedHub, SealedPeer } from './hub';
import { fromB64, type Bytes } from '../../shared/e2e/bytes';

// Device management travels only inside a sealed channel, so only an enrolled
// device can mint a code for a new one or revoke another. Handled before the
// dispatcher: these frames never exist on the plaintext path.

function key32(v: unknown): Bytes | null {
  if (typeof v !== 'string') return null;
  try { const b = fromB64(v); return b.length === 32 ? b : null; } catch { return null; }
}

export function deviceFrameHandler(agentPub: Bytes, hub: () => SealedHub | null, boxId?: string) {
  const reply = (peer: SealedPeer, m: unknown) => peer.send(JSON.stringify(m));
  const devices = (peer: SealedPeer) => reply(peer, {
    t: 'devices',
    items: listDevices().map((d) => ({ ...d, current: d.pub === peer.devicePub })),
  });

  const ownBox = (box: unknown) => !!boxId && typeof box === 'string' && box.toLowerCase() === boxId.toLowerCase();

  // A busy device list (the CLI writing it) is not a tampered frame: it answers
  // "not done" and leaves the channel open, instead of throwing out of deliver.
  return (peer: SealedPeer, text: string): boolean => {
    if (!text.startsWith('{"t":"device')) return false;
    let m: { t?: string; pub?: unknown; box?: unknown; key?: unknown; label?: unknown };
    try { m = JSON.parse(text); } catch { return true; }
    try { return handle(peer, m); } catch (e) {
      console.error('[agent] e2e:', (e as Error).message);
      const t = m.t === 'device-pin' ? 'device-pinned' : m.t === 'device-add-passkey' ? 'device-passkey-added' : 'error';
      reply(peer, t === 'error' ? { t, message: 'lista de aparelhos ocupada; tente de novo' } : { t, ok: false, busy: true });
      return true;
    }
  };

  function handle(peer: SealedPeer, m: { t?: string; pub?: unknown; box?: unknown; key?: unknown; label?: unknown }): boolean {
    if (m.t === 'devices-list') { devices(peer); return true; }
    if (m.t === 'device-code-new') {
      void createEnrollCode(agentPub)
        .then(({ code, expiresAt }) => reply(peer, { t: 'device-code', code, expiresAt }))
        .catch(() => reply(peer, { t: 'error', message: 'não consegui gerar o código' }));
      return true;
    }
    if (m.t === 'device-revoke' && typeof m.pub === 'string') {
      const pub = m.pub;
      if (revokeDevice(pub)) console.error(`[agent] e2e: device revoked (${pub.slice(0, 8)}…)`);
      devices(peer);
      hub()?.dropDevice(pub);
      return true;
    }
    // A device only sets the key behind the pin proofs sent to itself, and only
    // one derived for THIS box id: a key named for another box is never stored.
    if (m.t === 'device-pin') {
      const key = key32(m.key);
      const ok = !!key && ownBox(m.box) && setDevicePin(peer.devicePub, key);
      reply(peer, { t: 'device-pinned', ok });
      return true;
    }
    // An enrolled device moving to its passkey key: the same box check as
    // device-pin, and the new key is trusted with its pin key in one write.
    if (m.t === 'device-add-passkey') {
      const pub = key32(m.pub), key = key32(m.key);
      const label = typeof m.label === 'string' ? m.label.slice(0, 200) : '';
      const ok = !!pub && !!key && ownBox(m.box) && addPasskeyDevice(pub, label, key);
      if (ok) console.error(`[agent] e2e: passkey key added by an enrolled device (${String(m.pub).slice(0, 8)}…)`);
      reply(peer, { t: 'device-passkey-added', ok });
      return true;
    }
    return false;
  }
}
