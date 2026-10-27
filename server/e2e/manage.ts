import { createEnrollCode, listDevices, revokeDevice, setDevicePin } from './devices';
import type { SealedHub, SealedPeer } from './hub';
import { fromB64, type Bytes } from '../../shared/e2e/bytes';

// Device management travels only inside a sealed channel, so only an enrolled
// device can mint a code for a new one or revoke another. Handled before the
// dispatcher: these frames never exist on the plaintext path.

function pinKey(v: unknown): Bytes | null {
  if (typeof v !== 'string') return null;
  try { const b = fromB64(v); return b.length === 32 ? b : null; } catch { return null; }
}

export function deviceFrameHandler(agentPub: Bytes, hub: () => SealedHub | null, boxId?: string) {
  const reply = (peer: SealedPeer, m: unknown) => peer.send(JSON.stringify(m));
  const devices = (peer: SealedPeer) => reply(peer, {
    t: 'devices',
    items: listDevices().map((d) => ({ ...d, current: d.pub === peer.devicePub })),
  });

  return (peer: SealedPeer, text: string): boolean => {
    if (!text.startsWith('{"t":"device')) return false;
    let m: { t?: string; pub?: unknown; box?: unknown; key?: unknown };
    try { m = JSON.parse(text); } catch { return true; }
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
      const key = pinKey(m.key);
      const ok = !!key && !!boxId && typeof m.box === 'string' && m.box.toLowerCase() === boxId.toLowerCase()
        && setDevicePin(peer.devicePub, key);
      reply(peer, { t: 'device-pinned', ok });
      return true;
    }
    return false;
  };
}
