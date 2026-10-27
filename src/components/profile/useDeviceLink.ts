import { useCallback, useEffect, useMemo, useState } from 'react';
import { renderSVG } from 'uqr';
import { deviceFrames } from '../../cockpit/sealed-socket';
import { useBoxes } from '../../cockpit/useBoxes';
import { enrollLinkUrl, fmtCountdown, parseCodeFrame, type MintedCode } from '../../cockpit/enroll-link';
import { toast } from '../primitives';

// An enrolled device mints a one-time enroll code over its sealed channel and
// shows it as a QR of a Deck link (code in the fragment). The new device scans
// it and enrolls itself; nobody types anything.
export function useDeviceLink() {
  const { active } = useBoxes();
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const [minted, setMinted] = useState<MintedCode | null>(null);
  const [err, setErr] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    setMinted(null);
    setErr('');
    let waiting = true;
    const off = deviceFrames.subscribe((m) => {
      const c = parseCodeFrame(m);
      if (c && waiting) { waiting = false; setMinted(c); setNow(Date.now()); }
      else if (m.t === 'error' && waiting) { waiting = false; setErr(typeof m.message === 'string' ? m.message : 'não consegui gerar o código'); }
    });
    if (!deviceFrames.send({ t: 'device-code-new' })) setErr('Sem conexão cifrada com a VPS agora.');
    return off;
  }, [open, round]);

  useEffect(() => {
    if (!open || !minted) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open, minted]);

  const url = minted && active ? enrollLinkUrl(window.location.origin, { code: minted.code, box: active, expiresAt: minted.expiresAt }) : '';
  const qr = useMemo(
    () => (url ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderSVG(url, { ecc: 'M', border: 2, pixelSize: 8 }))}` : ''),
    [url],
  );
  const left = minted ? minted.expiresAt - now : 0;
  const expired = !!minted && left <= 0;

  const copy = useCallback(() => {
    if (!url) return;
    navigator.clipboard?.writeText(url)
      .then(() => toast('Link copiado. Abra no outro aparelho; vale uma vez, por 10 minutos.', { tone: 'ok' }))
      .catch(() => toast('Não consegui copiar o link.', { tone: 'error' }));
  }, [url]);

  return {
    open, start: () => setOpen(true), close: () => { setOpen(false); setMinted(null); },
    again: () => setRound((r) => r + 1),
    qr: expired ? '' : qr, code: minted?.code ?? '', countdown: fmtCountdown(left), expired, err, copy,
    loading: open && !minted && !err,
  };
}
