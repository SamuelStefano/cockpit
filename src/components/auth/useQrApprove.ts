import { useCallback, useEffect, useState } from 'react';
import { linkStore } from '../../cockpit/enroll-link-boot';
import { QR_APPROVE_KEY, QR_TICKET_KEY, answerRequest, clearQrKey, describeUa, peekRequest, readQrKey } from '../../cockpit/qr-login';
import { toast } from '../primitives';
import { currentAccessToken } from './qrSession';

// This signed-in device scanned a login screen's QR: show who asked and let the
// person approve or refuse. Nothing is approved without that tap.
export function useQrApprove(signedIn: boolean) {
  const [id, setId] = useState<string | null>(null);
  const [device, setDevice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    clearQrKey(linkStore(), QR_TICKET_KEY);
    const pending = readQrKey(linkStore(), QR_APPROVE_KEY);
    if (!pending) return;
    clearQrKey(linkStore(), QR_APPROVE_KEY);
    let live = true;
    void (async () => {
      const token = await currentAccessToken();
      const info = token ? await peekRequest(token, pending) : null;
      if (!live) return;
      if (!info) { toast('Este QR de login expirou ou já foi usado.', { tone: 'error' }); return; }
      setDevice(describeUa(info.ua));
      setId(pending);
    })();
    return () => { live = false; };
  }, [signedIn]);

  const answer = useCallback(async (approve: boolean) => {
    if (!id || busy) return;
    setBusy(true);
    const token = await currentAccessToken();
    const ok = token ? await answerRequest(token, id, approve) : false;
    setBusy(false);
    setId(null);
    if (!ok) toast('Este QR de login expirou ou já foi usado.', { tone: 'error' });
    else if (approve) toast('Pronto. O outro aparelho entrou na sua conta.', { tone: 'ok' });
  }, [id, busy]);

  return { open: !!id, device, busy, approve: () => void answer(true), refuse: () => void answer(false) };
}
