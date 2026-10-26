import { createEnrollCode, listDevices, revokeDevice } from './devices';
import type { SealedHub, SealedPeer } from './hub';
import type { Bytes } from '../../shared/e2e/bytes';

// Device management travels only inside a sealed channel, so only an enrolled
// device can mint a code for a new one or revoke another. Handled before the
// dispatcher: these frames never exist on the plaintext path.

export function deviceFrameHandler(agentPub: Bytes, hub: () => SealedHub | null) {
  const reply = (peer: SealedPeer, m: unknown) => peer.send(JSON.stringify(m));
  const devices = (peer: SealedPeer) => reply(peer, {
    t: 'devices',
    items: listDevices().map((d) => ({ ...d, current: d.pub === peer.devicePub })),
  });

  return (peer: SealedPeer, text: string): boolean => {
    if (!text.startsWith('{"t":"device')) return false;
    let m: { t?: string; pub?: unknown };
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
    return false;
  };
}
