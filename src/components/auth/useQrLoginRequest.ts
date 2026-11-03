import { useEffect, useMemo, useState } from 'react';
import { renderSVG } from 'uqr';
import { openRequest, pollRequest, qrApproveUrl, type QrRequest } from '../../cockpit/qr-login';
import { fmtCountdown } from '../../cockpit/enroll-link';
import { appOrigin } from '../../lib/origin';
import { sessionFromTokenHash } from './qrSession';

const POLL_MS = 2_000;

export type QrRequestPhase = 'loading' | 'waiting' | 'signing' | 'expired' | 'unavailable' | 'failed';

// The login screen opens a request and shows it as a QR; a signed-in device
// scans and approves; this tab polls with its secret and becomes that session.
export function useQrLoginRequest(active: boolean) {
  const [round, setRound] = useState(0);
  const [req, setReq] = useState<QrRequest | null>(null);
  const [phase, setPhase] = useState<QrRequestPhase>('loading');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setReq(null);
    setPhase('loading');
    void (async () => {
      const r = await openRequest();
      if (!live) return;
      if (!r) { setPhase('unavailable'); return; }
      setReq(r);
      setPhase('waiting');
      const tick = async () => {
        if (!live) return;
        if (Date.now() >= r.expiresAt) { setPhase('expired'); return; }
        const out = await pollRequest(r);
        if (!live) return;
        if (out.status === 'approved') {
          setPhase('signing');
          if (!(await sessionFromTokenHash(out.tokenHash)) && live) setPhase('failed');
          return;
        }
        if (out.status === 'gone') { setPhase(Date.now() >= r.expiresAt ? 'expired' : 'failed'); return; }
        timer = setTimeout(() => { void tick(); }, POLL_MS);
      };
      timer = setTimeout(() => { void tick(); }, POLL_MS);
    })();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [active, round]);

  useEffect(() => {
    if (!active || phase !== 'waiting') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, phase]);

  const qr = useMemo(
    () => (req ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderSVG(qrApproveUrl(appOrigin(), req.id), { ecc: 'M', border: 2, pixelSize: 8 }))}` : ''),
    [req],
  );

  return {
    phase,
    qr: phase === 'waiting' ? qr : '',
    code: phase === 'waiting' && req ? req.code : '',
    countdown: req ? fmtCountdown(req.expiresAt - now) : '',
    again: () => setRound((n) => n + 1),
  };
}
