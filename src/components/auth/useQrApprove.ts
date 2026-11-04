import { useCallback, useEffect, useState } from 'react';
import { linkStore } from '../../cockpit/enroll-link-boot';
import { QR_APPROVE_KEY, QR_TICKET_KEY, answerRequest, clearQrKey, describeUa, peekRequest, readQrKey, runOnce } from '../../cockpit/qr-login';
import { toast } from '../primitives';
import { currentAccessToken } from './qrSession';

let pendingId: string | null = null;

// This signed-in device opened a login screen's QR: show who asked and approve
// only with the 4-digit code printed next to that QR. A forwarded link has no
// code, so a tap alone never hands the account over.
export function useQrApprove(signedIn: boolean) {
  const [id, setId] = useState<string | null>(null);
  const [device, setDevice] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    clearQrKey(linkStore(), QR_TICKET_KEY);
    const pending = readQrKey(linkStore(), QR_APPROVE_KEY) ?? pendingId;
    if (!pending) return;
    pendingId = pending;
    clearQrKey(linkStore(), QR_APPROVE_KEY);
    let live = true;
    void runOnce(`peek:${pending}`, async () => {
      const token = await currentAccessToken();
      return token ? peekRequest(token, pending) : null;
    }).then((info) => {
      pendingId = null;
      if (!live) return;
      if (!info) { toast('Este QR de login expirou ou já foi usado.', { tone: 'error' }); return; }
      setDevice(describeUa(info.ua));
      setId(pending);
    });
    return () => { live = false; };
  }, [signedIn]);

  const answer = useCallback(async (approve: boolean) => {
    if (!id || busy) return;
    setBusy(true);
    setErr('');
    const token = await currentAccessToken();
    const out = token ? await answerRequest(token, id, approve, code) : 'gone';
    setBusy(false);
    if (out === 'bad-code') { setErr('Código errado. Confira o número embaixo do QR.'); setCode(''); return; }
    setId(null);
    setCode('');
    if (out === 'gone') toast('Este QR de login expirou ou já foi usado.', { tone: 'error' });
    else if (approve) toast('Pronto. O outro aparelho entrou na sua conta.', { tone: 'ok' });
  }, [id, busy, code]);

  return {
    open: !!id, device, busy, err, code,
    setCode: (v: string) => setCode(v.replace(/\D/g, '').slice(0, 4)),
    canApprove: code.length === 4,
    approve: () => void answer(true), refuse: () => void answer(false),
    dismiss: () => { setId(null); setCode(''); setErr(''); },
  };
}
