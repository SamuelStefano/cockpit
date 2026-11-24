import { useEffect, useState } from 'react';
import { linkStore } from '../../cockpit/enroll-link-boot';
import { QR_TICKET_KEY, clearQrKey, readQrKey, redeemTicket, runOnce } from '../../cockpit/qr-login';
import { sessionFromTokenHash } from './qrSession';

let pendingTicket: string | null = null;

export type TicketLoginState = 'idle' | 'busy' | 'failed';

// A QR from a signed-in device carried a login ticket: spend it once, on the
// login screen only. Failure falls back to the normal form.
export function useQrTicketLogin(): TicketLoginState {
  const [state, setState] = useState<TicketLoginState>(() => (readQrKey(linkStore(), QR_TICKET_KEY) ? 'busy' : 'idle'));
  useEffect(() => {
    const ticket = readQrKey(linkStore(), QR_TICKET_KEY) ?? pendingTicket;
    if (!ticket) return;
    pendingTicket = ticket;
    clearQrKey(linkStore(), QR_TICKET_KEY);
    let live = true;
    void runOnce(`ticket:${ticket}`, async () => {
      const hash = await redeemTicket(ticket);
      return hash ? sessionFromTokenHash(hash) : false;
    }).then((ok) => { pendingTicket = null; if (live && !ok) setState('failed'); });
    return () => { live = false; };
  }, []);
  return state;
}
