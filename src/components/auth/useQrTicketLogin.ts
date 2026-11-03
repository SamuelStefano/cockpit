import { useEffect, useState } from 'react';
import { linkStore } from '../../cockpit/enroll-link-boot';
import { QR_TICKET_KEY, clearQrKey, readQrKey, redeemTicket } from '../../cockpit/qr-login';
import { sessionFromTokenHash } from './qrSession';

export type TicketLoginState = 'idle' | 'busy' | 'failed';

// A QR from a signed-in device carried a login ticket: spend it once, on the
// login screen only. Failure falls back to the normal form.
export function useQrTicketLogin(): TicketLoginState {
  const [state, setState] = useState<TicketLoginState>(() => (readQrKey(linkStore(), QR_TICKET_KEY) ? 'busy' : 'idle'));
  useEffect(() => {
    const ticket = readQrKey(linkStore(), QR_TICKET_KEY);
    if (!ticket) return;
    clearQrKey(linkStore(), QR_TICKET_KEY);
    let live = true;
    void (async () => {
      const hash = await redeemTicket(ticket);
      const ok = hash ? await sessionFromTokenHash(hash) : false;
      if (live && !ok) setState('failed');
    })();
    return () => { live = false; };
  }, []);
  return state;
}
